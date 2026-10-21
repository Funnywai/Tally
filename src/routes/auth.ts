import type { RequestHandler } from 'express';
import { Router } from 'express';
import { clientIp } from '../auth/middleware.js';
import { passcodeMatches } from '../auth/passcode.js';
import { createRateLimiter } from '../auth/rate-limit.js';
import { serializeClearCookie, serializeSessionCookie, signSession } from '../auth/session.js';
import type { AppConfig } from '../config.js';
import { AppError } from '../errors.js';
import { authBodySchema } from '../schemas.js';

const requireJson: RequestHandler = (req, _res, next) => {
  if (!req.is('application/json')) {
    next(new AppError('UNSUPPORTED_MEDIA_TYPE'));
    return;
  }
  next();
};

export function createAuthRouter(config: AppConfig): Router {
  const router = Router();
  const rateLimiter = createRateLimiter();

  router.post('/', (req, res, next) => {
    const limit = rateLimiter(clientIp(req));
    if (!limit.allowed) {
      res.setHeader('Retry-After', String(limit.retryAfterSeconds));
      next(new AppError('RATE_LIMITED'));
      return;
    }

    const parsed = authBodySchema.safeParse(req.body);
    if (!parsed.success || !passcodeMatches(parsed.data.passcode, config.appPasscode)) {
      next(new AppError('UNAUTHORIZED'));
      return;
    }

    res.setHeader(
      'Set-Cookie',
      serializeSessionCookie(signSession(config.sessionSecret), config.cookieSecure),
    );
    res.status(204).end();
  });

  router.post('/logout', requireJson, (_req, res) => {
    res.setHeader('Set-Cookie', serializeClearCookie(config.cookieSecure));
    res.status(204).end();
  });

  return router;
}
