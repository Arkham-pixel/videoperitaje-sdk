import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config.js';
import { pingDb } from './db.js';
import { requireApiKey } from './auth.js';
import cupoRouter from './routes/cupo.js';
import sesionesRouter from './routes/sesiones.js';
import companiasRouter from './routes/companias.js';
import adminRouter from './routes/admin.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin.includes('*') ? true : config.corsOrigin,
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', async (_req, res) => {
  try {
    const dbOk = await pingDb();
    res.json({
      success: true,
      service: 'videoperitaje-sdk',
      db: dbOk ? 'ok' : 'fail',
      env: config.nodeEnv,
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      service: 'videoperitaje-sdk',
      db: 'fail',
      error: err.message,
    });
  }
});

app.use('/v1', requireApiKey);
app.use('/v1/cupo', cupoRouter);
app.use('/v1/sesiones', sesionesRouter);
app.use('/v1/companias', companiasRouter);
app.use('/v1/admin', adminRouter);

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

app.listen(config.port, () => {
  console.log(`[videoperitaje-sdk] listening on :${config.port}`);
  if (!config.apiKey) {
    console.warn('[videoperitaje-sdk] WARNING: API_KEY vacía');
  }
});
