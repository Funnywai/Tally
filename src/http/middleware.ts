import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, errorBody, isAppError } from '../errors.js';
import type { Logger } from '../logger.js';

export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
};

export const apiNoStore: RequestHandler = (req, res, next) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  next();
};

export const jsonOnly: RequestHandler = (req, _res, next) => {
  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    next();
    return;
  }

  const contentLength = Number(req.headers['content-length'] ?? '0');
  const hasBody = req.headers['transfer-encoding'] !== undefined || contentLength > 0;
  if (!hasBody) {
    next();
    return;
  }

  const contentType = req.headers['content-type'];
  if (contentType === undefined || !contentType.toLowerCase().startsWith('application/json')) {
    next(new AppError('UNSUPPORTED_MEDIA_TYPE'));
    return;
  }
  next();
};

export function requestLogger(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.info(
        {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Math.round(durationMs),
        },
        'request',
      );
    });
    next();
  };
}

export const apiNotFound: RequestHandler = (_req, _res, next) => {
  next(new AppError('NOT_FOUND'));
};

function bodyParserErrorType(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('type' in error)) {
    return null;
  }
  return typeof error.type === 'string' ? error.type : null;
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (isAppError(error)) {
      res.status(error.status).json(errorBody(error.code, error.message));
      return;
    }

    if (error instanceof ZodError) {
      res.status(400).json(errorBody('VALIDATION', error.issues[0]?.message ?? '輸入資料有誤'));
      return;
    }

    const type = bodyParserErrorType(error);
    if (type === 'entity.too.large') {
      res.status(413).json(errorBody('PAYLOAD_TOO_LARGE'));
      return;
    }
    if (type === 'entity.parse.failed') {
      if (req.path === '/api/auth') {
        res.status(401).json(errorBody('UNAUTHORIZED'));
        return;
      }
      res.status(400).json(errorBody('VALIDATION', 'JSON 格式錯誤'));
      return;
    }
    if (type === 'encoding.unsupported' || type === 'charset.unsupported') {
      res.status(415).json(errorBody('UNSUPPORTED_MEDIA_TYPE'));
      return;
    }

    logger.error({ err: error }, 'unhandled request error');
    res.status(500).json(errorBody('INTERNAL'));
  };
}
