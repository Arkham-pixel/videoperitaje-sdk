import dotenv from 'dotenv';

dotenv.config();

function truthy(v) {
  return ['1', 'true', 'yes', 'on'].includes(String(v || '').trim().toLowerCase());
}

export const config = {
  port: Number(process.env.PORT || 3088),
  nodeEnv: process.env.NODE_ENV || 'development',
  apiKey: String(process.env.API_KEY || '').trim(),
  corsOrigin: String(process.env.CORS_ORIGIN || '*')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
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
