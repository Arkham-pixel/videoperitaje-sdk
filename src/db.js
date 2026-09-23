import pg from 'pg';
import { config } from './config.js';

const { Pool } = pg;

const poolConfig = config.pg.connectionString
  ? {
      connectionString: config.pg.connectionString,
      ssl: config.pg.ssl || undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    }
  : {
      host: config.pg.host,
      port: config.pg.port,
      database: config.pg.database,
      user: config.pg.user,
      password: config.pg.password,
      ssl: config.pg.ssl || undefined,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    };

export const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[pg] error en pool:', err.message);
});

export async function query(text, params = []) {
  return pool.query(text, params);
}

export async function pingDb() {
  const r = await query('SELECT 1 AS ok');
  return r.rows[0]?.ok === 1;
}
