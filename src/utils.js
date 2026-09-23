/** modulo Arnald → codigo videoperitaje.companias */
export function moduloACompaniaCodigo(modulo = '') {
  const m = String(modulo || '')
    .trim()
    .toLowerCase();
  if (!m) return 'interna';
  if (m.startsWith('bbva')) return 'bbva';
  if (m === 'zurich') return 'zurich';
  if (m.startsWith('equidad')) return 'equidad';
  if (m === 'allianz') return 'allianz';
  if (m.startsWith('sura')) return 'sura';
  if (m === 'previsora') return 'previsora';
  if (m === 'seguros-alfa' || m === 'alfa' || m === 'segurosalfa') return 'alfa';
  return 'interna';
}

export function mapEstado(estado) {
  const e = String(estado || 'pendiente');
  if (['pendiente', 'en_proceso', 'finalizada', 'cancelada', 'timeout'].includes(e)) {
    return e;
  }
  return 'pendiente';
}
