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

/**
 * Misma regla que videoperitaje.puede_iniciar_sesion(), pero leyendo las tablas base:
 * la vista v_cupo_compania se edita a mano desde pgAdmin/Grafana y no es confiable.
 */
async function cupoDesdeTablas(companiaId) {
  const { rows } = await query(
    `SELECT
       COALESCE(s.sesiones_por_semana_override, p.sesiones_por_semana) AS sesiones_por_semana,
       COALESCE(s.sesiones_concurrentes_override, p.sesiones_concurrentes_max) AS sesiones_concurrentes_max,
       COALESCE(s.duracion_max_minutos_override, p.duracion_max_minutos) AS duracion_max_minutos,
       (SELECT COUNT(*)::INT FROM videoperitaje.sesiones se
         WHERE se.compania_id = s.compania_id
           AND se.semana_iso = videoperitaje.fn_semana_iso(NOW())
           AND se.estado <> 'cancelada') AS sesiones_usadas_semana,
       (SELECT COUNT(*)::INT FROM videoperitaje.sesiones se
         WHERE se.compania_id = s.compania_id
           AND se.estado = 'en_proceso') AS sesiones_concurrentes_ahora
     FROM videoperitaje.compania_suscripciones s
     JOIN videoperitaje.planes p ON p.id = s.plan_id
     WHERE s.compania_id = $1 AND s.estado = 'activa'
     LIMIT 1`,
    [companiaId]
  );
  const r = rows[0];
  if (!r) {
    return {
      permitido: false,
      motivo: 'sin_suscripcion_activa',
      sesiones_por_semana: 0,
      sesiones_usadas_semana: 0,
      sesiones_concurrentes_max: 0,
      sesiones_concurrentes_ahora: 0,
      duracion_max_minutos: 60,
    };
  }
  let motivo = 'ok';
  if (r.sesiones_usadas_semana >= r.sesiones_por_semana) motivo = 'cupo_semanal_agotado';
  else if (r.sesiones_concurrentes_ahora >= r.sesiones_concurrentes_max) motivo = 'max_concurrentes';
  return { ...r, permitido: motivo === 'ok', motivo };
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

    const cupo = await cupoDesdeTablas(compania.id);
    let permitido = Boolean(cupo.permitido);
    let motivo = String(cupo.motivo || 'sin_suscripcion_activa');

    // Con bolsa configurada, el tope semanal no aplica: manda la bolsa total.
    const bolsa = await estadoBolsa(compania.id);
    if (bolsa) {
      if (!permitido && motivo === 'cupo_semanal_agotado') {
        const lleno = cupo.sesiones_concurrentes_ahora >= cupo.sesiones_concurrentes_max;
        permitido = !lleno;
        motivo = lleno ? 'max_concurrentes' : 'ok';
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
