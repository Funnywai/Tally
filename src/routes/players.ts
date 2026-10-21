import { Router } from 'express';
import type { Db } from '../db.js';

export function createPlayersRouter(db: Db): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const result = await db.pool.query<{ id: string; name: string }>(
      'select id, name from players order by name asc',
    );
    res.json({ players: result.rows });
  });

  return router;
}
