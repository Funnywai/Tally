import { Router } from 'express';
import type { Db } from '../db.js';
import { getRanking } from '../stats/queries.js';

export function createRankingRouter(db: Db): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const ranking = await getRanking(db.pool);
    res.json({ ranking });
  });

  return router;
}
