import type { Pool, PoolClient } from 'pg';
import { encodeCursor, type RecordCursor } from './cursor.js';
import type { GameRow, RecordItem, SettlementRow } from './types.js';

type Queryable = Pool | PoolClient;

function mapRecords(games: GameRow[], settlements: SettlementRow[]): RecordItem[] {
  const playersByGame = new Map<string, RecordItem['players'][number][]>();
  for (const settlement of settlements) {
    const players = playersByGame.get(settlement.game_id) ?? [];
    players.push({
      playerId: settlement.player_id,
      name: settlement.name,
      score: Number(settlement.score),
    });
    playersByGame.set(settlement.game_id, players);
  }

  return games.map((game) => ({
    id: game.id,
    date: game.played_at,
    recordedAt: game.recorded_at.toISOString(),
    players: playersByGame.get(game.id) ?? [],
  }));
}

async function loadSettlements(db: Queryable, gameIds: string[]): Promise<SettlementRow[]> {
  if (gameIds.length === 0) {
    return [];
  }
  const result = await db.query<SettlementRow>(
    `select s.game_id, s.player_id, p.name, s.score
       from settlements s
       join players p on p.id = s.player_id
      where s.game_id = any($1::uuid[])
      order by p.name asc`,
    [gameIds],
  );
  return result.rows;
}

export interface ListRecordsResult {
  readonly items: RecordItem[];
  readonly nextCursor: string | null;
}

export async function listRecords(
  db: Queryable,
  limit: number,
  cursor: RecordCursor | null,
): Promise<ListRecordsResult> {
  const params: unknown[] = [];
  let whereClause = '';
  if (cursor !== null) {
    params.push(cursor.playedAt, cursor.recordedAt, cursor.id);
    whereClause =
      'where (g.played_at, g.recorded_at, g.id) < ($1::date, $2::timestamptz, $3::uuid)';
  }
  params.push(limit + 1);

  const result = await db.query<GameRow>(
    `select g.id, to_char(g.played_at, 'YYYY-MM-DD') as played_at, g.recorded_at
       from games g
       ${whereClause}
      order by g.played_at desc, g.recorded_at desc, g.id desc
      limit $${params.length}`,
    params,
  );

  const hasMore = result.rows.length > limit;
  const pageRows = hasMore ? result.rows.slice(0, limit) : result.rows;
  const settlements = await loadSettlements(
    db,
    pageRows.map((row) => row.id),
  );
  const items = mapRecords(pageRows, settlements);
  const last = items.at(-1);
  const nextCursor =
    hasMore && last !== undefined
      ? encodeCursor({ playedAt: last.date, recordedAt: last.recordedAt, id: last.id })
      : null;

  return { items, nextCursor };
}

export async function getRecord(db: Queryable, id: string): Promise<RecordItem | null> {
  const result = await db.query<GameRow>(
    `select g.id, to_char(g.played_at, 'YYYY-MM-DD') as played_at, g.recorded_at
       from games g
      where g.id = $1`,
    [id],
  );
  const game = result.rows[0];
  if (game === undefined) {
    return null;
  }
  const settlements = await loadSettlements(db, [game.id]);
  return mapRecords([game], settlements)[0] ?? null;
}
