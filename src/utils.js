/** modulo Arnald → codigo videoperitaje.companias */
export function moduloACompaniaCodigo(modulo = '') {
  const m = String(modulo || '')
    .trim()
    .toLowerCase();
  if (!m || m === 'independiente') return 'grupoproser';
  if (m.startsWith('bbva')) return 'bbva';
  if (m === 'zurich') return 'zurich';
  if (m.startsWith('equidad')) return 'equidad';
  if (m === 'allianz') return 'allianz';
  if (m.startsWith('sura')) return 'sura';
  if (m === 'previsora') return 'previsora';
  if (m === 'seguros-alfa' || m === 'alfa' || m === 'segurosalfa') return 'alfa';
  if (m === 'interna' || m === 'arnald' || m === 'grupoproser') return 'grupoproser';
  return 'grupoproser';
}

export function mapEstado(estado) {
  const e = String(estado || 'pendiente');
  if (['pendiente', 'en_proceso', 'finalizada', 'cancelada', 'timeout'].includes(e)) {
    return e;
  }
  return 'pendiente';
}
