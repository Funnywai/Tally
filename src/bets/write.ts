import type { PoolClient } from 'pg';
import type { Db } from '../db.js';
import { computeProfit, computeTotalOdds, round2 } from './profit.js';
import { getBet, loadBetLegs } from './read.js';
import type { BetItem, BetLegInput, BetResult } from './types.js';

export interface CreateBetData {
  readonly date: string;
  readonly stake: number;
  readonly result: BetResult;
  readonly legs: readonly BetLegInput[];
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

export async function createBet(db: Db, data: CreateBetData): Promise<BetItem> {
  return db.withTransaction(async (client) => {
    const totalOdds = computeTotalOdds(data.legs);
    const profit = computeProfit(data.stake, totalOdds, data.result);
    const inserted = await client.query<{ id: string }>(
      `insert into bets (bet_date, stake, total_odds, result, profit)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [data.date, round2(data.stake), totalOdds, data.result, profit],
    );
    const id = inserted.rows[0]?.id;
    if (id === undefined) {
      throw new Error('Bet insert returned no row');
    }
    await insertLegs(client, id, data.legs);
    const item = await getBet(client, id);
    if (item === null) {
      throw new Error('Created bet could not be read back');
    }
    return item;
  });
}

export async function updateBet(db: Db, id: string, data: UpdateBetData): Promise<BetItem | null> {
  return db.withTransaction(async (client) => {
    const current = await client.query<{
      bet_date: string;
      stake: string;
      result: BetResult;
    }>(
      `select to_char(bet_date, 'YYYY-MM-DD') as bet_date, stake::text, result
         from bets
        where id = $1
        for update`,
      [id],
    );
    const row = current.rows[0];
    if (row === undefined) {
      return null;
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
