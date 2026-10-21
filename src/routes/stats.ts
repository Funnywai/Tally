import { Router } from 'express';
import type { Db } from '../db.js';
import { AppError } from '../errors.js';
import { firstIssueMessage, statsQuerySchema } from '../schemas.js';
import { getPlayerStats } from '../stats/queries.js';
import { hkYear } from '../time.js';

export function createStatsRouter(db: Db): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const parsed = statsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const year = parsed.data.year ?? hkYear();
    const stats = await getPlayerStats(db.pool, parsed.data.player, year);
    res.json(stats);
  });

  return router;
}
