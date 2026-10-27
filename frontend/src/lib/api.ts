import { z } from 'zod';

import { jsonInit, requestJson, requestVoid } from './http';

export { ApiError, isApiError, isNetworkError } from './http';

const playerSchema = z.object({
  playerId: z.string(),
  name: z.string(),
  score: z.number(),
});

const recordSchema = z.object({
  id: z.string(),
  date: z.string(),
  recordedAt: z.string(),
  players: z.array(playerSchema),
});

const recordsResponseSchema = z.object({
  items: z.array(recordSchema),
  nextCursor: z.string().nullable(),
});

const playersResponseSchema = z.object({
  players: z.array(z.object({ id: z.string(), name: z.string() })),
});

const scoreDateSchema = z.object({
  score: z.number(),
  date: z.string(),
});

const statsSchema = z.object({
  player: z.string(),
  year: z.number(),
  yearTotal: z.number(),
  yearGames: z.number(),
  yearWins: z.number(),
  winRate: z.number().nullable(),
  best: scoreDateSchema.nullable(),
  worst: scoreDateSchema.nullable(),
  avgWin: z.number().nullable(),
  avgLoss: z.number().nullable(),
  allTimeGames: z.number(),
});

const rankingEntrySchema = z.object({
  playerId: z.string(),
  name: z.string(),
  total: z.number(),
  wins: z.number(),
  losses: z.number(),
  games: z.number(),
});

const rankingResponseSchema = z.object({
  ranking: z.array(rankingEntrySchema),
});

export type RecordItem = z.infer<typeof recordSchema>;
export type RecordsResponse = z.infer<typeof recordsResponseSchema>;
export type Player = z.infer<typeof playersResponseSchema>['players'][number];
export type PlayerStats = z.infer<typeof statsSchema>;
export type RankingEntry = z.infer<typeof rankingEntrySchema>;

export async function login(passcode: string): Promise<void> {
  await requestVoid('/api/auth', jsonInit('POST', { passcode }));
}

export async function fetchPlayers(): Promise<Player[]> {
  const data = await requestJson('/api/players', {}, playersResponseSchema);
  return data.players;
}

export async function fetchRecords(cursor?: string): Promise<RecordsResponse> {
  const params = new URLSearchParams({ limit: '50' });
  if (cursor !== undefined) {
    params.set('cursor', cursor);
  }
  return requestJson(`/api/records?${params.toString()}`, {}, recordsResponseSchema);
}

export async function createRecord(
  players: readonly { name: string; score: number }[],
): Promise<RecordItem> {
  return requestJson('/api/records', jsonInit('POST', { players }), recordSchema);
}

export async function updateRecord(
  id: string,
  date: string,
  players: readonly { playerId: string; name: string; score: number }[],
): Promise<RecordItem> {
  return requestJson(
    `/api/records/${encodeURIComponent(id)}`,
    jsonInit('PATCH', { date, players }),
    recordSchema,
  );
}

export async function deleteRecord(id: string): Promise<void> {
  await requestVoid(`/api/records/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function fetchStats(player: string, year: number): Promise<PlayerStats> {
  const params = new URLSearchParams({ player, year: String(year) });
  return requestJson(`/api/stats?${params.toString()}`, {}, statsSchema);
}

export async function fetchRanking(): Promise<RankingEntry[]> {
  const data = await requestJson('/api/ranking', {}, rankingResponseSchema);
  return data.ranking;
}
