import type { PoolClient } from 'pg';
import type { Db } from '../db.js';
import { AppError } from '../errors.js';
import { computeProfit, computeTotalOdds, round2 } from './profit.js';
import { getBet, loadBetLegs } from './read.js';
import type {
  BetImportItem,
  BetImportItemResult,
  BetImportResponse,
  BetItem,
  BetLegInput,
  BetResult,
} from './types.js';

export interface CreateBetData {
  readonly date: string;
  readonly stake: number;
  readonly result: BetResult;
  readonly legs: readonly BetLegInput[];
  readonly externalId?: string | null;
  readonly profitOverride?: number | null | undefined;
}

export interface UpdateBetData {
  readonly date?: string | undefined;
  readonly stake?: number | undefined;
  readonly result?: BetResult | undefined;
  readonly legs?: readonly BetLegInput[] | undefined;
}

async function insertLegs(
  client: PoolClient,
  betId: string,
  legs: readonly BetLegInput[],
): Promise<void> {
  for (const [index, leg] of legs.entries()) {
    await client.query(
      `insert into bet_legs (bet_id, position, match, market, selection, odds)
       values ($1, $2, $3, $4, $5, $6)`,
      [betId, index + 1, leg.match, leg.market, leg.selection, round2(leg.odds)],
    );
  }
}

function resolveCashOutProfit(value: number | null | undefined): number {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    throw new AppError('VALIDATION', '派彩快注單需要提供實際盈虧');
  }
  return round2(value);
}

async function insertBet(client: PoolClient, data: CreateBetData): Promise<string | null> {
  const totalOdds = computeTotalOdds(data.legs);
  const profit =
    data.result === 'cash_out'
      ? resolveCashOutProfit(data.profitOverride)
      : computeProfit(data.stake, totalOdds, data.result);
  const inserted = await client.query<{ id: string }>(
    `insert into bets (bet_date, stake, total_odds, result, profit, external_id)
     values ($1, $2, $3, $4, $5, $6)
     on conflict do nothing
     returning id`,
    [data.date, round2(data.stake), totalOdds, data.result, profit, data.externalId ?? null],
  );
  const id = inserted.rows[0]?.id;
  if (id === undefined) {
    return null;
  }
  await insertLegs(client, id, data.legs);
  return id;
}

export async function createBet(db: Db, data: CreateBetData): Promise<BetItem> {
  return db.withTransaction(async (client) => {
    const id = await insertBet(client, data);
    if (id === null) {
      throw new Error('Bet insert returned no row');
    }
    const item = await getBet(client, id);
    if (item === null) {
      throw new Error('Created bet could not be read back');
    }
    return item;
  });
}

export async function importBets(
  db: Db,
  items: readonly BetImportItem[],
  dryRun: boolean,
): Promise<BetImportResponse> {
  return db.withTransaction(async (client) => {
    const existing = await client.query<{ external_id: string }>(
      'select external_id from bets where external_id = any($1::text[])',
      [items.map((item) => item.externalId)],
    );
    const existingIds = new Set(existing.rows.map((row) => row.external_id));

    const results: BetImportItemResult[] = [];
    let imported = 0;
    let skipped = 0;

    for (const item of items) {
      if (existingIds.has(item.externalId)) {
        results.push({ externalId: item.externalId, status: 'duplicate' });
        skipped += 1;
        continue;
      }
      if (dryRun) {
        results.push({ externalId: item.externalId, status: 'new' });
        continue;
      }

      const id = await insertBet(client, item);
      if (id === null) {
        results.push({ externalId: item.externalId, status: 'duplicate' });
        skipped += 1;
        continue;
      }
      results.push({ externalId: item.externalId, status: 'imported' });
      imported += 1;
    }

    return { dryRun, imported, skipped, items: results };
  });
}

export async function updateBet(db: Db, id: string, data: UpdateBetData): Promise<BetItem | null> {
  return db.withTransaction(async (client) => {
    const current = await client.query<{
      bet_date: string;
      stake: string;
      total_odds: string;
      result: BetResult;
      profit: string | null;
    }>(
      `select to_char(bet_date, 'YYYY-MM-DD') as bet_date,
              stake::text,
              total_odds::text,
              result,
              profit::text
         from bets
        where id = $1
        for update`,
      [id],
    );
    const row = current.rows[0];
    if (row === undefined) {
      return null;
    }

    if (row.result === 'cash_out') {
      if (data.stake !== undefined || data.result !== undefined || data.legs !== undefined) {
        throw new AppError('VALIDATION', '派彩快注單不可修改注碼、結果或注項');
      }
      await client.query(
        `update bets
            set bet_date = $2,
                updated_at = now()
          where id = $1`,
        [id, data.date ?? row.bet_date],
      );

      const item = await getBet(client, id);
      if (item === null) {
        throw new Error('Updated bet could not be read back');
      }
      return item;
    }

    const legs =
      data.legs ??
      (await loadBetLegs(client, id)).map((leg) => ({
        match: leg.match,
        market: leg.market,
        selection: leg.selection,
        odds: Number(leg.odds),
      }));
    const stake = data.stake ?? Number(row.stake);
    const result = data.result ?? row.result;
    if (result === 'cash_out') {
      throw new AppError('VALIDATION', '只可透過匯入建立派彩快注單');
    }
    const totalOdds = computeTotalOdds(legs);
    const profit = computeProfit(stake, totalOdds, result);

    await client.query(
      `update bets
          set bet_date = $2,
              stake = $3,
              total_odds = $4,
              result = $5,
              profit = $6,
              updated_at = now()
        where id = $1`,
      [id, data.date ?? row.bet_date, round2(stake), totalOdds, result, profit],
    );

    if (data.legs !== undefined) {
      await client.query('delete from bet_legs where bet_id = $1', [id]);
      await insertLegs(client, id, data.legs);
    }

    const item = await getBet(client, id);
    if (item === null) {
      throw new Error('Updated bet could not be read back');
    }
    return item;
  });
}

export async function deleteBet(db: Db, id: string): Promise<boolean> {
  const result = await db.pool.query('delete from bets where id = $1 returning id', [id]);
  return result.rowCount === 1;
}
