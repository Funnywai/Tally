import { z } from 'zod';

const errorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

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

export async function doFetch(path: string, init: RequestInit): Promise<Response> {
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

export function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export async function requestJson<T>(
  path: string,
  init: RequestInit,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await doFetch(path, init);
  const body: unknown = await response.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ApiError(500, 'INVALID_RESPONSE', '伺服器回應格式錯誤');
  }
  return parsed.data;
}

export async function requestVoid(path: string, init: RequestInit): Promise<void> {
  await doFetch(path, init);
}
