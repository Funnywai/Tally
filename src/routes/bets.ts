import { Router } from 'express';
import { decodeBetCursor } from '../bets/cursor.js';
import { listBets } from '../bets/read.js';
import { getBetStats, getOverview } from '../bets/stats.js';
import { createBet, deleteBet, updateBet } from '../bets/write.js';
import type { Db } from '../db.js';
import { AppError } from '../errors.js';
import {
  betIdSchema,
  betStatsQuerySchema,
  createBetSchema,
  firstIssueMessage,
  listBetsQuerySchema,
  patchBetSchema,
} from '../schemas.js';
import { hkToday } from '../time.js';

export function createBetsRouter(db: Db): Router {
  const router = Router();

  router.get('/overview', async (_req, res) => {
    res.json(await getOverview(db.pool));
  });

  router.get('/stats', async (req, res) => {
    const parsed = betStatsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }
    res.json(await getBetStats(db.pool, parsed.data.period));
  });

  router.get('/', async (req, res) => {
    const parsed = listBetsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const cursor = parsed.data.cursor === undefined ? null : decodeBetCursor(parsed.data.cursor);
    if (parsed.data.cursor !== undefined && cursor === null) {
      throw new AppError('VALIDATION', '分頁游標無效');
    }

    res.json(await listBets(db.pool, parsed.data.limit, cursor, parsed.data.status));
  });

  router.post('/', async (req, res) => {
    const parsed = createBetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const item = await createBet(db, {
      date: parsed.data.date ?? hkToday(),
      stake: parsed.data.stake,
      result: parsed.data.result,
      legs: parsed.data.legs,
    });
    res.status(201).json(item);
  });

  router.patch('/:id', async (req, res) => {
    const id = betIdSchema.safeParse(req.params.id);
    if (!id.success) {
      throw new AppError('VALIDATION', '注單 ID 無效');
    }
    const parsed = patchBetSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const item = await updateBet(db, id.data, parsed.data);
    if (item === null) {
      throw new AppError('NOT_FOUND');
    }
    res.json(item);
  });

  router.delete('/:id', async (req, res) => {
    const id = betIdSchema.safeParse(req.params.id);
    if (!id.success) {
      throw new AppError('VALIDATION', '注單 ID 無效');
    }

    const deleted = await deleteBet(db, id.data);
    if (!deleted) {
      throw new AppError('NOT_FOUND');
    }
    res.status(204).end();
  });

  return router;
}
