import { Router } from 'express';
import { query } from '../db.js';
import { moduloACompaniaCodigo } from '../utils.js';

const router = Router();

const MOTIVO_MSG = {
  sin_suscripcion_activa: 'La compañía no tiene suscripción activa de videoperitaje',
  cupo_semanal_agotado: 'Cupo semanal de sesiones agotado para esta compañía',
  max_concurrentes: 'Ya hay el máximo de sesiones simultáneas para esta compañía',
};

async function resolverCompaniaId(codigo) {
  const { rows } = await query(
    `SELECT id, codigo, nombre FROM videoperitaje.companias
     WHERE codigo = $1 AND activa = TRUE LIMIT 1`,
    [codigo]
  );
  return rows[0] || null;
}

/** GET /v1/cupo?modulo=bbva-cat  |  ?compania=bbva */
router.get('/', async (req, res) => {
  try {
    const codigo =
      String(req.query.compania || '').trim() ||
      moduloACompaniaCodigo(req.query.modulo);
    const compania = await resolverCompaniaId(codigo);
    if (!compania) {
      return res.status(404).json({
        success: false,
        code: 'COMPANIA_NO_REGISTRADA',
        error: `Compañía "${codigo}" no registrada`,
      });
    }

    const { rows } = await query(`SELECT * FROM videoperitaje.puede_iniciar_sesion($1)`, [
      compania.id,
    ]);
    const cupo = rows[0] || {};
    const permitido = Boolean(cupo.permitido);
    const motivo = String(cupo.motivo || 'sin_suscripcion_activa');

    return res.json({
      success: true,
      permitido,
      motivo,
      error: permitido ? null : MOTIVO_MSG[motivo] || 'Cupo no disponible',
      compania: { id: compania.id, codigo: compania.codigo, nombre: compania.nombre },
      cupo: {
        sesiones_por_semana: cupo.sesiones_por_semana,
        sesiones_usadas_semana: cupo.sesiones_usadas_semana,
        sesiones_concurrentes_max: cupo.sesiones_concurrentes_max,
        sesiones_concurrentes_ahora: cupo.sesiones_concurrentes_ahora,
        duracion_max_minutos: cupo.duracion_max_minutos,
      },
    });
  } catch (err) {
    console.error('[cupo]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
