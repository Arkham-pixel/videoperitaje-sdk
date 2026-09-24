/**
 * Arnald = UNA empresa (Grupo Proser).
 * Los módulos (bbva-cat, zurich, etc.) solo son origen/reporte;
 * el cupo y la suscripción siempre van contra `grupoproser`.
 */
export function moduloACompaniaCodigo(_modulo = '') {
  return 'grupoproser';
}

export function mapEstado(estado) {
  const e = String(estado || 'pendiente');
  if (['pendiente', 'en_proceso', 'finalizada', 'cancelada', 'timeout'].includes(e)) {
    return e;
  }
  return 'pendiente';
}
