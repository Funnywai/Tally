import { createHmac, timingSafeEqual } from 'node:crypto';
import { stringifySetCookie } from 'cookie';
import { z } from 'zod';

export const SESSION_COOKIE_NAME = 'mj_session';
export const SESSION_MAX_AGE_SECONDS = 2_592_000;

const sessionPayloadSchema = z.object({
  v: z.literal(1),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
});

export type SessionPayload = z.infer<typeof sessionPayloadSchema>;

function sign(encodedPayload: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(encodedPayload).digest();
}

export function signSession(
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): string {
  const payload: SessionPayload = {
    v: 1,
    iat: nowSeconds,
    exp: nowSeconds + SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = sign(encodedPayload, secret).toString('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySession(
  token: string,
  secret: string,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }
  const encodedPayload = parts[0];
  const encodedSignature = parts[1];
  if (encodedPayload === undefined || encodedSignature === undefined) {
    return null;
  }

  const expected = sign(encodedPayload, secret);
  const provided = Buffer.from(encodedSignature, 'base64url');
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  const result = sessionPayloadSchema.safeParse(parsed);
  if (!result.success) {
    return null;
  }
  if (result.data.exp <= nowSeconds) {
    return null;
  }
  if (result.data.iat > nowSeconds + 60) {
    return null;
  }
  return result.data;
}

export function serializeSessionCookie(token: string, secure: boolean): string {
  return stringifySetCookie({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function serializeClearCookie(secure: boolean): string {
  return stringifySetCookie({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}
