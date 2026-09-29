/**
 * Cierre obligatorio por duración del plan (Postgres).
 * Usa duracion_max_minutos de cada sesión; libera cupo concurrente.
 */
import { query } from './db.js';
import { config } from './config.js';

let running = false;
let timer = null;

async function insertarEvento(sesionPgId, tipo, meta = {}) {
  if (!sesionPgId) return;
  await query(
    `INSERT INTO videoperitaje.sesion_eventos (sesion_id, tipo, rol, actor_login, meta)
     VALUES ($1, $2, 'sistema', 'sdk-auto-cierre', $3::jsonb)`,
    [sesionPgId, tipo, JSON.stringify(meta)]
  );
}

async function notificarArnald(sesion, motivo) {
  const url = config.arnaldCierreWebhookUrl;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.arnaldWebhookKey || config.apiKey,
      },
      body: JSON.stringify({
        mongo_sesion_id: sesion.mongo_sesion_id,
        estado: sesion.estado,
        motivo,
        finalizada_at: sesion.finalizada_at,
        duracion_segundos: sesion.duracion_segundos,
        source: 'videoperitaje-sdk-auto-cierre',
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(
        `[auto-cierre] webhook Arnald HTTP ${res.status}:`,
        text.slice(0, 200)
      );
    }
  } catch (err) {
    console.warn('[auto-cierre] webhook Arnald:', err.message);
  }
}

/**
 * 1) en_proceso que superó duracion_max_minutos → timeout
 * 2) pendiente demasiado tiempo sin iniciar → cancelada
 * 3) estado ya cerrado pero finalizada_at NULL → rellena fin (fantasma de cupo)
 */
export async function ejecutarAutoCierreSesiones() {
  if (running) return { skipped: true, reason: 'overlap' };
  running = true;
  try {
    const pendienteMax = config.autoCierre.pendienteMaxMin;

    // Fantasmas: cerrados sin finalizada_at
    const fantasmas = await query(
      `UPDATE videoperitaje.sesiones SET
         finalizada_at = COALESCE(finalizada_at, NOW()),
         updated_at = NOW()
       WHERE finalizada_at IS NULL
         AND estado IN ('finalizada', 'cancelada', 'timeout')
       RETURNING id, mongo_sesion_id, estado, nombre_asegurado`
    );

    // en_proceso > duracion_max_minutos de la propia fila
    const vencidas = await query(
      `UPDATE videoperitaje.sesiones SET
         estado = 'timeout',
         finalizada_at = NOW(),
         duracion_segundos = COALESCE(
           NULLIF(duracion_segundos, 0),
           GREATEST(
             0,
             EXTRACT(EPOCH FROM (NOW() - COALESCE(iniciada_at, created_at)))::INT
           )
         ),
         notas = TRIM(BOTH E'\n' FROM COALESCE(notas, '') || E'\n[auto] timeout: superó duracion_max_minutos'),
         updated_at = NOW()
       WHERE finalizada_at IS NULL
         AND estado = 'en_proceso'
         AND COALESCE(iniciada_at, created_at) < NOW() - make_interval(mins => GREATEST(COALESCE(duracion_max_minutos, 60), 1))
       RETURNING id, mongo_sesion_id, estado, nombre_asegurado, duracion_max_minutos,
                 iniciada_at, finalizada_at, duracion_segundos`
    );

    // pendiente sin iniciar
    const pendientes = await query(
      `UPDATE videoperitaje.sesiones SET
         estado = 'cancelada',
         finalizada_at = NOW(),
         duracion_segundos = 0,
         notas = TRIM(BOTH E'\n' FROM COALESCE(notas, '') || E'\n[auto] cancelada: pendiente sin iniciar'),
         updated_at = NOW()
       WHERE finalizada_at IS NULL
         AND estado = 'pendiente'
         AND created_at < NOW() - make_interval(mins => $1::int)
       RETURNING id, mongo_sesion_id, estado, nombre_asegurado, finalizada_at, duracion_segundos`,
      [pendienteMax]
    );

    for (const row of vencidas.rows) {
      await insertarEvento(row.id, 'timeout', {
        motivo: 'duracion_max',
        duracion_max_minutos: row.duracion_max_minutos,
      });
      await notificarArnald(row, 'duracion_max');
    }
    for (const row of pendientes.rows) {
      await insertarEvento(row.id, 'force_end', { motivo: 'pendiente_expirada' });
      await notificarArnald(row, 'pendiente_expirada');
    }

    const summary = {
      fantasmasFin: fantasmas.rowCount,
      timeoutDuracion: vencidas.rowCount,
      canceladasPendiente: pendientes.rowCount,
    };

    if (
      summary.fantasmasFin ||
      summary.timeoutDuracion ||
      summary.canceladasPendiente
    ) {
      console.log(JSON.stringify({ event: 'videoperitaje-sdk-auto-cierre', ...summary }));
    }

    return summary;
  } finally {
    running = false;
  }
}

export function iniciarAutoCierre() {
  if (!config.autoCierre.enabled) {
    console.log('[auto-cierre] deshabilitado (AUTO_CIERRE_ENABLED=false)');
    return;
  }
  if (timer) clearInterval(timer);

  const tick = () => {
    ejecutarAutoCierreSesiones().catch((err) => {
      console.error('[auto-cierre] error:', err.message);
    });
  };

  setTimeout(tick, 10_000);
  timer = setInterval(tick, config.autoCierre.intervalMs);

  console.log(
    `[auto-cierre] activo cada ${Math.round(config.autoCierre.intervalMs / 60000)} min ` +
      `(en_proceso > duracion_max_minutos de la sesión; pendiente > ${config.autoCierre.pendienteMaxMin} min)`
  );
}

export function detenerAutoCierre() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
