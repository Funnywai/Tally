import type { Pool, PoolClient } from 'pg';
import { type BetCursor, encodeBetCursor } from './cursor.js';
import type { BetItem, BetLegRow, BetRow, BetStatusFilter } from './types.js';

type Queryable = Pool | PoolClient;

const BET_COLUMNS = `b.id,
       to_char(b.bet_date, 'YYYY-MM-DD') as bet_date,
       b.stake::text as stake,
       b.total_odds::text as total_odds,
       b.result,
       b.profit::text as profit,
       b.created_at`;

function mapLeg(row: BetLegRow): BetItem['legs'][number] {
  return {
    position: row.position,
    match: row.match,
    market: row.market,
    selection: row.selection,
    odds: Number(row.odds),
  };
}

function mapBet(row: BetRow, legs: BetLegRow[]): BetItem {
  return {
    id: row.id,
    date: row.bet_date,
    recordedAt: row.created_at.toISOString(),
    stake: Number(row.stake),
    result: row.result,
    legs: legs.map(mapLeg),
    totalOdds: Number(row.total_odds),
    profit: row.profit === null ? null : Number(row.profit),
  };
}

async function loadLegsForBets(
  db: Queryable,
  betIds: readonly string[],
): Promise<Map<string, BetLegRow[]>> {
  if (betIds.length === 0) {
    return new Map();
  }
  const result = await db.query<BetLegRow>(
    `select bet_id, position, match, market, selection, odds::text
       from bet_legs
      where bet_id = any($1::uuid[])
      order by bet_id asc, position asc`,
    [betIds],
  );
  const byBet = new Map<string, BetLegRow[]>();
  for (const row of result.rows) {
    const list = byBet.get(row.bet_id) ?? [];
    list.push(row);
    byBet.set(row.bet_id, list);
  }
  return byBet;
}

export async function loadBetLegs(db: Queryable, betId: string): Promise<BetLegRow[]> {
  const byBet = await loadLegsForBets(db, [betId]);
  return byBet.get(betId) ?? [];
}

export async function getBet(db: Queryable, id: string): Promise<BetItem | null> {
  const result = await db.query<BetRow>(`select ${BET_COLUMNS} from bets b where b.id = $1`, [id]);
  const row = result.rows[0];
  if (row === undefined) {
    return null;
  }
  return mapBet(row, await loadBetLegs(db, row.id));
}

export interface ListBetsResult {
  readonly items: BetItem[];
  readonly nextCursor: string | null;
}

export async function listBets(
  db: Queryable,
  limit: number,
  cursor: BetCursor | null,
  status: BetStatusFilter,
): Promise<ListBetsResult> {
  const params: unknown[] = [];
  const conditions: string[] = [];

  if (status === 'pending') {
    conditions.push(`b.result = 'pending'`);
  }
  if (status === 'settled') {
    conditions.push(`b.result <> 'pending'`);
  }
  if (cursor !== null) {
    params.push(cursor.betDate, cursor.createdAt, cursor.id);
    conditions.push(`(b.bet_date, b.created_at, b.id) < ($1::date, $2::timestamptz, $3::uuid)`);
  }

  params.push(limit + 1);
  const where = conditions.length === 0 ? '' : `where ${conditions.join(' and ')}`;
  const result = await db.query<BetRow>(
    `select ${BET_COLUMNS}
       from bets b
       ${where}
      order by b.bet_date desc, b.created_at desc, b.id desc
      limit $${params.length}`,
    params,
  );

  const hasMore = result.rows.length > limit;
  const pageRows = hasMore ? result.rows.slice(0, limit) : result.rows;
  const legsByBet = await loadLegsForBets(
    db,
    pageRows.map((row) => row.id),
  );
  const items = pageRows.map((row) => mapBet(row, legsByBet.get(row.id) ?? []));
  const last = items.at(-1);
  const nextCursor =
    hasMore && last !== undefined
      ? encodeBetCursor({ betDate: last.date, createdAt: last.recordedAt, id: last.id })
      : null;

  return { items, nextCursor };
}
