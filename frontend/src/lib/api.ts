import { z } from 'zod';

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

const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type RecordItem = z.infer<typeof recordSchema>;
export type RecordsResponse = z.infer<typeof recordsResponseSchema>;
export type Player = z.infer<typeof playersResponseSchema>['players'][number];
export type PlayerStats = z.infer<typeof statsSchema>;
export type RankingEntry = z.infer<typeof rankingEntrySchema>;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isNetworkError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 0;
}

function notifyUnauthorized(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('tally:unauthorized'));
  }
}

function defaultMessage(status: number): string {
  if (status === 429) {
    return '嘗試次數過多，請稍後再試';
  }
  if (status >= 500) {
    return '伺服器暫時無法使用';
  }
  return '請求失敗';
}

const REQUEST_TIMEOUT_MS = 8_000;

async function doFetch(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', controller.signal.aborted ? '連線逾時' : '網絡連線失敗');
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) {
    notifyUnauthorized();
    throw new ApiError(401, 'UNAUTHORIZED', '未授權');
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const parsed = errorBodySchema.safeParse(body);
    const code = parsed.success ? parsed.data.error.code : 'INTERNAL';
    const message = parsed.success ? parsed.data.error.message : defaultMessage(response.status);
    throw new ApiError(response.status, code, message);
  }

  return response;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function requestJson<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
  const response = await doFetch(path, init);
  const body: unknown = await response.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(500, 'INVALID_RESPONSE', '伺服器回應格式錯誤');
  }
  return parsed.data;
}

async function requestVoid(path: string, init: RequestInit): Promise<void> {
  await doFetch(path, init);
}

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
  players: readonly { playerId: string; name: string; score: number }[],
): Promise<RecordItem> {
  return requestJson(
    `/api/records/${encodeURIComponent(id)}`,
    jsonInit('PATCH', { players }),
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
