import { Router } from 'express';
import { query } from '../db.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    const { rows } = await query(
      `SELECT id, codigo, nombre, activa FROM videoperitaje.companias ORDER BY codigo`
    );
    return res.json({ success: true, data: rows });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
