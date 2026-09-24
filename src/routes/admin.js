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

export default router;
