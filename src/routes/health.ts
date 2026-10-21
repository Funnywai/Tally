import { Router } from 'express';
import type { Db } from '../db.js';

export function createHealthRouter(db: Db): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const dbHealthy = await db.health();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: dbHealthy, db: dbHealthy });
  });

  return router;
}
