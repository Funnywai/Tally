import path from 'node:path';
import express, { type Express, type RequestHandler, type Response } from 'express';

const NO_CACHE = 'no-cache';
const IMMUTABLE = 'public, max-age=31536000, immutable';

function setStaticHeaders(res: Response, filePath: string): void {
  const base = path.basename(filePath);
  if (base === 'manifest.webmanifest') {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', NO_CACHE);
    return;
  }
  if (base === 'sw.js') {
    res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    res.setHeader('Cache-Control', NO_CACHE);
    return;
  }
  if (base === 'index.html') {
    res.setHeader('Cache-Control', NO_CACHE);
    return;
  }
  if (filePath.includes(`${path.sep}assets${path.sep}`)) {
    res.setHeader('Cache-Control', IMMUTABLE);
    return;
  }
  res.setHeader('Cache-Control', 'public, max-age=3600');
}

export function mountStatic(app: Express, publicDir: string): void {
  app.use(express.static(publicDir, { index: 'index.html', setHeaders: setStaticHeaders }));

  const indexPath = path.join(publicDir, 'index.html');
  const spaFallback: RequestHandler = (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    if (req.path === '/api' || req.path.startsWith('/api/')) {
      next();
      return;
    }
    if (path.extname(req.path) !== '') {
      next();
      return;
    }
    res.setHeader('Cache-Control', NO_CACHE);
    res.sendFile(indexPath);
  };
  app.use(spaFallback);
}
