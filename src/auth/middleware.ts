import { parseCookie } from 'cookie';
import type { Request, RequestHandler } from 'express';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { SESSION_COOKIE_NAME, verifySession } from './session.js';

export function clientIp(req: Request): string {
  const cloudflareIp = req.header('cf-connecting-ip');
  if (cloudflareIp !== undefined && cloudflareIp.trim() !== '') {
    return cloudflareIp.trim();
  }
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export function readSessionToken(req: Request): string | null {
  const header = req.headers.cookie;
  if (header === undefined) {
    return null;
  }
  const cookies = parseCookie(header);
  const token = cookies[SESSION_COOKIE_NAME];
  return token === undefined || token === '' ? null : token;
}

export function requireAuth(config: AppConfig): RequestHandler {
  return (req, _res, next) => {
    const token = readSessionToken(req);
    if (token === null || verifySession(token, config.sessionSecret) === null) {
      next(new AppError('UNAUTHORIZED'));
      return;
    }
    next();
  };
}
