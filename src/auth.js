import { config } from './config.js';

export function requireApiKey(req, res, next) {
  if (!config.apiKey) {
    return res.status(500).json({
      success: false,
      error: 'API_KEY no configurada en el SDK',
      code: 'SDK_MISCONFIGURED',
    });
  }
  const key = String(req.headers['x-api-key'] || req.headers['authorization'] || '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (!key || key !== config.apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key inválida',
      code: 'UNAUTHORIZED',
    });
  }
  return next();
}
