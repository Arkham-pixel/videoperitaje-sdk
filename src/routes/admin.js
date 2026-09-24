import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

/**
 * POST /v1/admin/suscripciones/suspender
 * Body opcional: { "compania": "grupoproser" }
 * Sin body → suspende TODAS las activas (cupo 0).
 */
router.post('/suscripciones/suspender', async (req, res) => {
  try {
    const codigo = String(req.body?.compania || req.query.compania || '').trim();
    let result;
    if (codigo) {
      result = await query(
        `UPDATE videoperitaje.compania_suscripciones s
         SET estado = 'suspendida',
             updated_at = NOW(),
             notas = COALESCE(s.notas || ' | ', '') || 'Suspendida vía API (pago obligatorio)'
         FROM videoperitaje.companias c
         WHERE s.compania_id = c.id
           AND c.codigo = $1
           AND s.estado = 'activa'
         RETURNING s.id, c.codigo, s.estado`,
        [codigo]
      );
    } else {
      result = await query(
        `UPDATE videoperitaje.compania_suscripciones
         SET estado = 'suspendida',
             updated_at = NOW(),
             notas = COALESCE(notas || ' | ', '') || 'Suspendida vía API (pago obligatorio)'
         WHERE estado = 'activa'
         RETURNING id, estado`
      );
    }
    return res.json({
      success: true,
      suspendidas: result.rowCount || 0,
      data: result.rows,
      mensaje: 'Cupo en 0: hace falta activar suscripción (pago)',
    });
  } catch (err) {
    console.error('[admin.suspender]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /v1/admin/suscripciones/activar
 * Body: { "compania": "grupoproser", "plan": "pro", "sesiones_por_semana": 1 }
 */
router.post('/suscripciones/activar', async (req, res) => {
  try {
    const codigo = String(req.body?.compania || 'grupoproser').trim();
    const planCodigo = String(req.body?.plan || 'basico').trim();
    const cupoSemana =
      req.body?.sesiones_por_semana != null ? Number(req.body.sesiones_por_semana) : 1;
    const concurrentes =
      req.body?.sesiones_concurrentes != null ? Number(req.body.sesiones_concurrentes) : 1;

    // Suspender activas de esa compañía
    await query(
      `UPDATE videoperitaje.compania_suscripciones s
       SET estado = 'suspendida', updated_at = NOW()
       FROM videoperitaje.companias c
       WHERE s.compania_id = c.id AND c.codigo = $1 AND s.estado = 'activa'`,
      [codigo]
    );

    // Para demo: reiniciar contador semanal (marca cancelada las de esta semana)
    let resetSemana = 0;
    if (req.body?.reset_semana === true || req.body?.resetSemana === true) {
      const reset = await query(
        `UPDATE videoperitaje.sesiones s
         SET estado = 'cancelada', updated_at = NOW()
         FROM videoperitaje.companias c
         WHERE s.compania_id = c.id
           AND c.codigo = $1
           AND s.semana_iso = videoperitaje.fn_semana_iso(NOW())
           AND s.estado <> 'cancelada'
         RETURNING s.id`,
        [codigo]
      );
      resetSemana = reset.rowCount || 0;
    }

    const { rows } = await query(
      `INSERT INTO videoperitaje.compania_suscripciones (
         compania_id, plan_id, estado,
         sesiones_por_semana_override, sesiones_concurrentes_override,
         notas
       )
       SELECT c.id, p.id, 'activa', $3, $4, $5
       FROM videoperitaje.companias c
       CROSS JOIN videoperitaje.planes p
       WHERE c.codigo = $1 AND p.codigo = $2
       RETURNING id, estado, sesiones_por_semana_override, sesiones_concurrentes_override`,
      [
        codigo,
        planCodigo,
        cupoSemana,
        concurrentes,
        `Activada demo/pago: ${cupoSemana} sesiones/semana`,
      ]
    );

    if (!rows[0]) {
      return res.status(404).json({
        success: false,
        error: `Compañía "${codigo}" o plan "${planCodigo}" no encontrados`,
      });
    }

    return res.json({
      success: true,
      data: rows[0],
      compania: codigo,
      plan: planCodigo,
      sesiones_por_semana: cupoSemana,
      sesiones_concurrentes: concurrentes,
      sesiones_semana_reseteadas: resetSemana,
    });
  } catch (err) {
    console.error('[admin.activar]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
