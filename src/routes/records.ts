import { Router } from 'express';
import type { Db } from '../db.js';
import { AppError } from '../errors.js';
import { decodeCursor, type RecordCursor } from '../records/cursor.js';
import { listRecords } from '../records/read.js';
import { createRecord, deleteRecord, updateRecord } from '../records/write.js';
import {
  createRecordSchema,
  firstIssueMessage,
  listRecordsQuerySchema,
  patchRecordSchema,
  recordIdSchema,
} from '../schemas.js';
import { hkToday } from '../time.js';

export function createRecordsRouter(db: Db): Router {
  const router = Router();

  router.get('/', async (req, res) => {
    const parsed = listRecordsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    let cursor: RecordCursor | null = null;
    if (parsed.data.cursor !== undefined) {
      cursor = decodeCursor(parsed.data.cursor);
      if (cursor === null) {
        throw new AppError('VALIDATION', '分頁游標無效');
      }
    }

    const result = await listRecords(db.pool, parsed.data.limit, cursor);
    res.json(result);
  });

  router.post('/', async (req, res) => {
    const parsed = createRecordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const item = await createRecord(db, {
      date: parsed.data.date ?? hkToday(),
      players: parsed.data.players,
    });
    res.status(201).json(item);
  });

  router.patch('/:id', async (req, res) => {
    const id = recordIdSchema.safeParse(req.params.id);
    if (!id.success) {
      throw new AppError('VALIDATION', '記錄 ID 無效');
    }
    const parsed = patchRecordSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError('VALIDATION', firstIssueMessage(parsed.error));
    }

    const item = await updateRecord(db, id.data, parsed.data);
    if (item === null) {
      throw new AppError('NOT_FOUND');
    }
    res.json(item);
  });

  router.delete('/:id', async (req, res) => {
    const id = recordIdSchema.safeParse(req.params.id);
    if (!id.success) {
      throw new AppError('VALIDATION', '記錄 ID 無效');
    }

    const deleted = await deleteRecord(db, id.data);
    if (!deleted) {
      throw new AppError('NOT_FOUND');
    }
    res.status(204).end();
  });

  return router;
}
