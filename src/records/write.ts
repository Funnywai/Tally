import type { PoolClient } from 'pg';
import type { Db } from '../db.js';
import { AppError } from '../errors.js';
import type { PatchPlayerInput } from '../schemas.js';
import { round1 } from '../time.js';
import { getRecord } from './read.js';
import type { RecordItem } from './types.js';

export interface CreateRecordData {
  readonly date: string;
  readonly players: readonly { readonly name: string; readonly score: number }[];
}

export interface UpdateRecordData {
  readonly date?: string | undefined;
  readonly players?: readonly PatchPlayerInput[] | undefined;
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return false;
  }
  return error.code === '23505';
}

async function resolvePlayerId(client: PoolClient, name: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `insert into players (name) values ($1)
     on conflict (name) do update set name = excluded.name
     returning id`,
    [name],
  );
  const row = result.rows[0];
  if (row === undefined) {
    throw new Error('Player upsert returned no row');
  }
  return row.id;
}

async function renamePlayer(client: PoolClient, playerId: string, name: string): Promise<void> {
  const conflict = await client.query<{ id: string }>(
    'select id from players where name = $1 and id <> $2',
    [name, playerId],
  );
  if (conflict.rows.length > 0) {
    throw new AppError('CONFLICT', '名稱已被其他玩家使用');
  }
  try {
    await client.query('update players set name = $1 where id = $2', [name, playerId]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('CONFLICT', '名稱已被其他玩家使用');
    }
    throw error;
  }
}

async function insertSettlements(
  client: PoolClient,
  gameId: string,
  players: readonly { readonly playerId: string; readonly score: number }[],
): Promise<void> {
  await client.query(
    `insert into settlements (game_id, player_id, score)
     select $1::uuid, unnest($2::uuid[]), unnest($3::numeric[])`,
    [
      gameId,
      players.map((player) => player.playerId),
      players.map((player) => round1(player.score)),
    ],
  );
}

export async function createRecord(db: Db, data: CreateRecordData): Promise<RecordItem> {
  return db.withTransaction(async (client) => {
    const resolved: { playerId: string; score: number }[] = [];
    for (const player of data.players) {
      resolved.push({
        playerId: await resolvePlayerId(client, player.name),
        score: player.score,
      });
    }

    const game = await client.query<{ id: string }>(
      'insert into games (played_at) values ($1) returning id',
      [data.date],
    );
    const gameId = game.rows[0]?.id;
    if (gameId === undefined) {
      throw new Error('Game insert returned no row');
    }

    await insertSettlements(client, gameId, resolved);
    const item = await getRecord(client, gameId);
    if (item === null) {
      throw new Error('Created record could not be read back');
    }
    return item;
  });
}

export async function updateRecord(
  db: Db,
  id: string,
  data: UpdateRecordData,
): Promise<RecordItem | null> {
  return db.withTransaction(async (client) => {
    const locked = await client.query<{ id: string }>(
      'select id from games where id = $1 for update',
      [id],
    );
    if (locked.rows.length === 0) {
      return null;
    }

    if (data.date !== undefined) {
      await client.query('update games set played_at = $1 where id = $2', [data.date, id]);
    }

    if (data.players !== undefined) {
      const current = await client.query<{ player_id: string; name: string }>(
        `select s.player_id, p.name
           from settlements s
           join players p on p.id = s.player_id
          where s.game_id = $1`,
        [id],
      );
      const currentNames = new Map(current.rows.map((row) => [row.player_id, row.name]));

      const resolved: { playerId: string; score: number }[] = [];
      const seen = new Set<string>();
      for (const player of data.players) {
        let playerId: string;
        if (player.playerId !== undefined && player.playerId !== null) {
          const currentName = currentNames.get(player.playerId);
          if (currentName === undefined) {
            throw new AppError('VALIDATION', '玩家不屬於此記錄');
          }
          if (currentName !== player.name) {
            await renamePlayer(client, player.playerId, player.name);
          }
          playerId = player.playerId;
        } else {
          playerId = await resolvePlayerId(client, player.name);
        }

        if (seen.has(playerId)) {
          throw new AppError('CONFLICT', '同一記錄不可有重複玩家');
        }
        seen.add(playerId);
        resolved.push({ playerId, score: player.score });
      }

      await client.query('delete from settlements where game_id = $1', [id]);
      await insertSettlements(client, id, resolved);
    }

    const item = await getRecord(client, id);
    if (item === null) {
      throw new Error('Updated record could not be read back');
    }
    return item;
  });
}

export async function deleteRecord(db: Db, id: string): Promise<boolean> {
  const result = await db.pool.query('delete from games where id = $1 returning id', [id]);
  return result.rowCount === 1;
}
