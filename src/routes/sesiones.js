import { Router } from 'express';
import { query } from '../db.js';
import { mapEstado, moduloACompaniaCodigo } from '../utils.js';

const router = Router();

async function resolverCompaniaId(codigo) {
  const { rows } = await query(
    `SELECT id FROM videoperitaje.companias WHERE codigo = $1 AND activa = TRUE LIMIT 1`,
    [codigo]
  );
  return rows[0]?.id || null;
}

async function upsertAuditor({ companiaId, userId, login, nombre, email, telefono }) {
  const loginNorm = String(login || '').trim();
  if (!loginNorm || !companiaId) return null;
  const { rows } = await query(
    `INSERT INTO videoperitaje.auditores
       (compania_id, user_id_arnald, login_arnald, nombre, email, telefono, activo)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)
     ON CONFLICT (login_arnald) DO UPDATE SET
       user_id_arnald = COALESCE(EXCLUDED.user_id_arnald, videoperitaje.auditores.user_id_arnald),
       nombre = CASE WHEN EXCLUDED.nombre <> '' THEN EXCLUDED.nombre ELSE videoperitaje.auditores.nombre END,
       email = COALESCE(NULLIF(EXCLUDED.email, ''), videoperitaje.auditores.email),
       telefono = COALESCE(NULLIF(EXCLUDED.telefono, ''), videoperitaje.auditores.telefono),
       activo = TRUE,
       updated_at = NOW()
     RETURNING id`,
    [
      companiaId,
      String(userId || '') || null,
      loginNorm,
      String(nombre || '').trim(),
      String(email || '').trim() || null,
      String(telefono || '').trim() || null,
    ]
  );
  return rows[0]?.id || null;
}

async function insertarEvento(sesionPgId, tipo, rol, actorLogin, meta = {}) {
  if (!sesionPgId) return;
  await query(
    `INSERT INTO videoperitaje.sesion_eventos (sesion_id, tipo, rol, actor_login, meta)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [sesionPgId, tipo, rol || null, actorLogin || null, JSON.stringify(meta || {})]
  );
}

/**
 * POST /v1/sesiones
 * Body: mongo_sesion_id, modulo, caso_id, expediente, siniestro, livekit_room,
 *       auditor, asegurado, estado, duracion_max_minutos, notas
 */
router.post('/', async (req, res) => {
  try {
    const b = req.body || {};
    const mongoId = String(b.mongo_sesion_id || b.mongoSesionId || '').trim();
    if (!mongoId) {
      return res.status(400).json({ success: false, error: 'mongo_sesion_id requerido' });
    }

    const codigo = String(b.compania || '').trim() || moduloACompaniaCodigo(b.modulo);
    const companiaId = await resolverCompaniaId(codigo);
    if (!companiaId) {
      return res.status(404).json({
        success: false,
        code: 'COMPANIA_NO_REGISTRADA',
        error: `Compañía "${codigo}" no registrada`,
      });
    }

    const auditor = b.auditor || {};
    const asegurado = b.asegurado || {};
    const auditorId = await upsertAuditor({
      companiaId,
      userId: auditor.user_id || auditor.userId,
      login: auditor.login,
      nombre: auditor.nombre,
      email: auditor.email,
      telefono: auditor.telefono,
    });

    const { rows } = await query(
      `INSERT INTO videoperitaje.sesiones (
         mongo_sesion_id, modulo, caso_id, expediente, siniestro, livekit_room, origen,
         compania_id, auditor_id,
         identificacion_asegurado, nombre_asegurado, telefono, correo,
         estado, duracion_max_minutos, notas
       ) VALUES (
         $1, $2, $3, $4, $5, $6, COALESCE($7, 'arnald'),
         $8, $9,
         $10, $11, $12, $13,
         $14, $15, $16
       )
       ON CONFLICT (mongo_sesion_id) DO UPDATE SET
         modulo = EXCLUDED.modulo,
         caso_id = EXCLUDED.caso_id,
         expediente = EXCLUDED.expediente,
         siniestro = EXCLUDED.siniestro,
         livekit_room = EXCLUDED.livekit_room,
         auditor_id = COALESCE(EXCLUDED.auditor_id, videoperitaje.sesiones.auditor_id),
         identificacion_asegurado = COALESCE(EXCLUDED.identificacion_asegurado, videoperitaje.sesiones.identificacion_asegurado),
         nombre_asegurado = EXCLUDED.nombre_asegurado,
         telefono = EXCLUDED.telefono,
         correo = EXCLUDED.correo,
         estado = EXCLUDED.estado,
         duracion_max_minutos = EXCLUDED.duracion_max_minutos,
         updated_at = NOW()
       RETURNING *`,
      [
        mongoId,
        String(b.modulo || ''),
        b.caso_id || b.casoId ? String(b.caso_id || b.casoId) : null,
        String(b.expediente || '') || null,
        String(b.siniestro || '') || null,
        String(b.livekit_room || b.livekitRoom || '') || null,
        String(b.origen || 'arnald'),
        companiaId,
        auditorId,
        String(asegurado.identificacion || b.identificacion_asegurado || '') || null,
        String(asegurado.nombre || b.nombre_asegurado || ''),
        String(asegurado.telefono || b.telefono || '') || null,
        String(asegurado.correo || b.correo || '') || null,
        mapEstado(b.estado || 'pendiente'),
        Number(b.duracion_max_minutos || b.duracionMaxMinutos) || 60,
        String(b.notas || '') || null,
      ]
    );

    const sesion = rows[0];
    await insertarEvento(sesion.id, 'invite_sent', 'sistema', auditor.login, {
      mongo_sesion_id: mongoId,
    });

    return res.status(201).json({ success: true, data: sesion });
  } catch (err) {
    console.error('[sesiones.create]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * PATCH /v1/sesiones/:mongoSesionId
 * Body: estado, iniciada_at, finalizada_at, duracion_segundos, livekit_room, notas
 */
router.patch('/:mongoSesionId', async (req, res) => {
  try {
    const mongoId = String(req.params.mongoSesionId || '').trim();
    const b = req.body || {};
    const estado = b.estado != null ? mapEstado(b.estado) : null;

    const { rows } = await query(
      `UPDATE videoperitaje.sesiones SET
         estado = COALESCE($2, estado),
         iniciada_at = COALESCE($3::timestamptz, iniciada_at),
         finalizada_at = COALESCE($4::timestamptz, finalizada_at),
         duracion_segundos = COALESCE($5, duracion_segundos),
         livekit_room = COALESCE(NULLIF($6, ''), livekit_room),
         notas = COALESCE(NULLIF($7, ''), notas),
         updated_at = NOW()
       WHERE mongo_sesion_id = $1
       RETURNING *`,
      [
        mongoId,
        estado,
        b.iniciada_at || b.iniciadaAt || null,
        b.finalizada_at || b.finalizadaAt || null,
        b.duracion_segundos != null
          ? Number(b.duracion_segundos)
          : b.duracionSegundos != null
            ? Number(b.duracionSegundos)
            : null,
        String(b.livekit_room || b.livekitRoom || ''),
        String(b.notas || ''),
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error('[sesiones.patch]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /v1/sesiones/:mongoSesionId/eventos
 * Body: tipo, rol, actor_login, meta
 */
router.post('/:mongoSesionId/eventos', async (req, res) => {
  try {
    const mongoId = String(req.params.mongoSesionId || '').trim();
    const b = req.body || {};
    const tipo = String(b.tipo || '').trim();
    const allowed = [
      'connect',
      'disconnect',
      'rejoin',
      'timeout',
      'force_end',
      'invite_sent',
      'room_created',
      'room_closed',
    ];
    if (!allowed.includes(tipo)) {
      return res.status(400).json({
        success: false,
        error: `tipo inválido. Use: ${allowed.join(', ')}`,
      });
    }

    const { rows } = await query(
      `SELECT id FROM videoperitaje.sesiones WHERE mongo_sesion_id = $1 LIMIT 1`,
      [mongoId]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
    }

    // Si connect y aún pendiente → en_proceso
    if (tipo === 'connect') {
      await query(
        `UPDATE videoperitaje.sesiones SET
           estado = CASE WHEN estado = 'pendiente' THEN 'en_proceso' ELSE estado END,
           iniciada_at = COALESCE(iniciada_at, NOW()),
           updated_at = NOW()
         WHERE id = $1`,
        [rows[0].id]
      );
    }

    if (['disconnect', 'force_end', 'room_closed', 'timeout'].includes(tipo) && b.cerrar) {
      const estadoCierre = tipo === 'timeout' ? 'timeout' : mapEstado(b.estado || 'finalizada');
      await query(
        `UPDATE videoperitaje.sesiones SET
           estado = $2,
           finalizada_at = COALESCE(finalizada_at, NOW()),
           duracion_segundos = COALESCE($3, duracion_segundos),
           updated_at = NOW()
         WHERE id = $1`,
        [rows[0].id, estadoCierre, b.duracion_segundos != null ? Number(b.duracion_segundos) : null]
      );
    }

    await insertarEvento(
      rows[0].id,
      tipo,
      b.rol || null,
      b.actor_login || b.actorLogin || null,
      b.meta || {}
    );

    return res.status(201).json({ success: true });
  } catch (err) {
    console.error('[sesiones.eventos]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/** GET /v1/sesiones/:mongoSesionId */
router.get('/:mongoSesionId', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT * FROM videoperitaje.sesiones WHERE mongo_sesion_id = $1 LIMIT 1`,
      [String(req.params.mongoSesionId)]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
    }
    return res.json({ success: true, data: rows[0] });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
