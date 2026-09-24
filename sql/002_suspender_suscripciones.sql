-- =============================================================================
-- Suspender TODAS las suscripciones activas → cupo 0 (pago/activación obligatorio)
-- Ejecutar YA en Postgres VideoPeritaje (Coolify)
-- =============================================================================

UPDATE videoperitaje.compania_suscripciones
SET
  estado = 'suspendida',
  updated_at = NOW(),
  notas = COALESCE(notas || ' | ', '') || 'Suspendida: activación/pago obligatorio'
WHERE estado = 'activa';

-- Debe quedar vacío (ninguna activa)
SELECT c.codigo, c.nombre, s.estado
FROM videoperitaje.compania_suscripciones s
JOIN videoperitaje.companias c ON c.id = s.compania_id
WHERE s.estado = 'activa';
