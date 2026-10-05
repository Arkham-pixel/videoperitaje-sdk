import { query } from './db.js';

/**
 * Bolsa total de videoperitajes por compañía (sin reinicio semanal).
 * Cuenta TODAS las sesiones registradas (cualquier estado) desde `desde`
 * (NULL = desde siempre) + `usadas_previas` (sesiones anteriores al SDK).
 * No depende de la suscripción: reactivar o cambiar plan no devuelve cupo.
 */
export async function asegurarEsquemaBolsa() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS videoperitaje.compania_bolsa (
        compania_id BIGINT PRIMARY KEY,
        sesiones_bolsa INT NOT NULL CHECK (sesiones_bolsa > 0),
        usadas_previas INT NOT NULL DEFAULT 0 CHECK (usadas_previas >= 0),
        desde TIMESTAMPTZ,
        notas TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    console.log('[bolsa] esquema listo');
  } catch (err) {
    console.error('[bolsa] no se pudo crear compania_bolsa:', err.message);
  }
}

/** null si la compañía no tiene bolsa configurada. */
export async function estadoBolsa(companiaId) {
  let rows;
  try {
    ({ rows } = await query(
      `SELECT b.sesiones_bolsa, b.usadas_previas, b.desde, b.notas, b.updated_at,
              (SELECT COUNT(*)::INT FROM videoperitaje.sesiones s
                WHERE s.compania_id = b.compania_id
                  AND (b.desde IS NULL OR s.created_at >= b.desde)) AS sesiones_registradas,
              (SELECT MIN(s.created_at) FROM videoperitaje.sesiones s
                WHERE s.compania_id = b.compania_id) AS primera_sesion_at
       FROM videoperitaje.compania_bolsa b
       WHERE b.compania_id = $1`,
      [companiaId]
    ));
  } catch (err) {
    if (err.code === '42P01') return null;
    throw err;
  }
  const b = rows[0];
  if (!b) return null;
  const usadas = b.usadas_previas + b.sesiones_registradas;
  return {
    sesiones_bolsa: b.sesiones_bolsa,
    sesiones_usadas_bolsa: usadas,
    sesiones_restantes_bolsa: Math.max(0, b.sesiones_bolsa - usadas),
    usadas_previas: b.usadas_previas,
    sesiones_registradas: b.sesiones_registradas,
    desde: b.desde,
    primera_sesion_at: b.primera_sesion_at,
    notas: b.notas,
    updated_at: b.updated_at,
  };
}

export async function configurarBolsa(companiaId, { sesionesBolsa, usadasPrevias, desde, notas }) {
  await query(
    `INSERT INTO videoperitaje.compania_bolsa
       (compania_id, sesiones_bolsa, usadas_previas, desde, notas)
     VALUES ($1, $2, COALESCE($3, 0), $4::timestamptz, $5)
     ON CONFLICT (compania_id) DO UPDATE SET
       sesiones_bolsa = EXCLUDED.sesiones_bolsa,
       usadas_previas = COALESCE($3, videoperitaje.compania_bolsa.usadas_previas),
       desde = CASE WHEN $6 THEN EXCLUDED.desde ELSE videoperitaje.compania_bolsa.desde END,
       notas = COALESCE(EXCLUDED.notas, videoperitaje.compania_bolsa.notas),
       updated_at = NOW()`,
    [companiaId, sesionesBolsa, usadasPrevias, desde || null, notas || null, desde !== undefined]
  );
  return estadoBolsa(companiaId);
}
