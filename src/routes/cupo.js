import { Router } from 'express';
import { query } from '../db.js';
import { estadoBolsa } from '../bolsa.js';
import { moduloACompaniaCodigo } from '../utils.js';

const router = Router();

const MOTIVO_MSG = {
  sin_suscripcion_activa: 'La compañía no tiene suscripción activa de videoperitaje',
  cupo_semanal_agotado: 'Cupo semanal de sesiones agotado para esta compañía',
  max_concurrentes: 'Ya hay el máximo de sesiones simultáneas para esta compañía',
  bolsa_agotada: 'Bolsa de videoperitajes agotada. Contrate una nueva bolsa para continuar.',
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
    let permitido = Boolean(cupo.permitido);
    let motivo = String(cupo.motivo || 'sin_suscripcion_activa');

    // Con bolsa configurada, el tope semanal no aplica: manda la bolsa total.
    const bolsa = await estadoBolsa(compania.id);
    if (bolsa) {
      if (!permitido && motivo === 'cupo_semanal_agotado') {
        permitido = true;
        motivo = 'ok';
      }
      if (permitido && bolsa.sesiones_restantes_bolsa <= 0) {
        permitido = false;
        motivo = 'bolsa_agotada';
      }
    }

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
        ...(bolsa
          ? {
              sesiones_bolsa: bolsa.sesiones_bolsa,
              sesiones_usadas_bolsa: bolsa.sesiones_usadas_bolsa,
              sesiones_restantes_bolsa: bolsa.sesiones_restantes_bolsa,
            }
          : {}),
      },
    });
  } catch (err) {
    console.error('[cupo]', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
