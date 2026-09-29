import dotenv from 'dotenv';

dotenv.config();

function truthy(v, defaultVal = false) {
  if (v == null || String(v).trim() === '') return defaultVal;
  return ['1', 'true', 'yes', 'on'].includes(String(v).trim().toLowerCase());
}

function num(name, fallback) {
  const n = Number.parseInt(String(process.env[name] || ''), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const config = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiKey: String(process.env.API_KEY || '').trim(),
  corsOrigin: String(process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /** Webhook Arnald: cierra Mongo + LiveKit cuando el SDK hace timeout. */
  arnaldCierreWebhookUrl: String(process.env.ARNALD_CIERRE_WEBHOOK_URL || '').trim(),
  arnaldWebhookKey: String(
    process.env.ARNALD_WEBHOOK_KEY || process.env.API_KEY || ''
  ).trim(),
  autoCierre: {
    enabled: truthy(process.env.AUTO_CIERRE_ENABLED, true),
    intervalMs: num('AUTO_CIERRE_INTERVAL_MS', 60_000),
    /** Pendiente sin iniciar (minutos). en_proceso usa duracion_max_minutos de la fila. */
    pendienteMaxMin: num('AUTO_CIERRE_PENDIENTE_MAX_MIN', 240),
  },
  pg: {
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.PGHOST || process.env.VIDEOPERITAJE_PG_HOST || '127.0.0.1',
    port: Number(process.env.PGPORT || process.env.VIDEOPERITAJE_PG_PORT || 5432),
    database: process.env.PGDATABASE || process.env.VIDEOPERITAJE_PG_DATABASE || 'VideoPeritaje',
    user: process.env.PGUSER || process.env.VIDEOPERITAJE_PG_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.VIDEOPERITAJE_PG_PASSWORD || '',
    ssl: truthy(process.env.PGSSL || process.env.VIDEOPERITAJE_PG_SSL)
      ? { rejectUnauthorized: false }
      : false,
  },
};
