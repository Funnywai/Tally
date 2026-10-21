# Tally — Mahjong & Football

Self-hosted ledger backend for the Mahjong scoring app. This repository contains **Phase A
(infrastructure + backend)** only. The frontend/PWA is Phase B and will replace the placeholder in
`public/`.

- Runtime: Node.js 22 + Express 5 + raw PostgreSQL (`pg`) + Zod 4 + TypeScript 5.9
- Package manager: pnpm
- Tests: Vitest (unit + integration against a real PostgreSQL 16 database)
- Deployment: Docker Compose (`web` + `db` + `cloudflared`), exposed only through a Cloudflare
  Named Tunnel at `tally.funnywai.tech`
- No Firebase, no Vercel, no ORM, no CORS, no inbound published ports in production

## Architecture

```
Browser / installed PWA
        │ HTTPS (Cloudflare-managed certificate)
        ▼
Cloudflare Named Tunnel  ──►  cloudflared container
                                   │ http://web:3000 (compose network)
                                   ▼
                            web container (Node 22 / Express 5)
                              ├── /api/*  (JSON API, shared-passcode cookie auth)
                              └── public/ (static placeholder; Phase B replaces it)
                                   │ postgres://db:5432 (compose network)
                                   ▼
                            db container (postgres:16-alpine, named volume)
```

Only `cloudflared` talks to the public internet. `web` and `db` publish no ports in
`docker-compose.yml`. `docker-compose.debug.yml` adds loopback-only ports for local debugging.

## Repository layout

```
migrations/                 idempotent SQL migrations (auto-applied on startup)
src/
  auth/                     session HMAC, passcode compare, rate limit, requireAuth
  http/                     security headers, JSON-only guard, error handler, static serving
  records/                  keyset cursor, read/write repositories
  routes/                   auth, health, records, players, stats, ranking
  stats/                    SQL aggregation for stats and ranking
  app.ts                    createApp(deps) for tests
  server.ts                 config → pool → migrations → listen → graceful shutdown
  migrate.ts                migration runner + CLI
scripts/
  import-firebase-json.mjs  idempotent Firebase RTDB import + --verify
  backup.sh                 pg_dump + gzip + keep newest 14
  restore.sh                drop/recreate public schema + restore
  smoke-test.sh             end-to-end curl proof
tests/                      Vitest unit + integration tests and fixtures
docs/api.http               REST Client examples for every endpoint
public/index.html           Phase A placeholder
```

## Local development

Prerequisites: Node 22, pnpm, Docker.

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Start a local PostgreSQL 16 test database:

   ```bash
   docker run --rm -d --name tally-test-db \
     -e POSTGRES_USER=tally \
     -e POSTGRES_PASSWORD=test \
     -e POSTGRES_DB=tally_test \
     -p 127.0.0.1:5433:5432 \
     postgres:16-alpine
   ```

3. Create a local `.env` (never commit it). For plain-HTTP local development set
   `COOKIE_SECURE=false`; production must keep it `true`.

   ```dotenv
   NODE_ENV=development
   PORT=3000
   TZ=Asia/Hong_Kong
   LOG_LEVEL=info
   DATABASE_URL=postgres://tally:test@127.0.0.1:5433/tally_test
   APP_PASSCODE=local-dev-passcode-0123456789abcdef
   SESSION_SECRET=local-dev-session-secret-0123456789abcdef
   COOKIE_SECURE=false
   ```

4. Build and run:

   ```bash
   pnpm build
   pnpm start:local        # node --env-file=.env dist/server.js
   ```

   Migrations are applied automatically on startup. To run them manually:

   ```bash
   node --env-file=.env dist/migrate.js
   ```

   For watch mode, run `pnpm dev` (TypeScript compiler in watch mode) in one terminal and
   `pnpm start:dev` (Node watch mode) in another.

5. Verify:

   ```bash
   curl -sS http://127.0.0.1:3000/api/health
   # {"ok":true,"db":true}
   ```

### Tests

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Integration tests use `TEST_DATABASE_URL`, defaulting to
`postgres://tally:test@127.0.0.1:5433/tally_test`. The database name must end with `_test`; the test
helper refuses to run otherwise, so a shell that loaded a production `DATABASE_URL` cannot make
`pnpm test` truncate production tables. Tests truncate `settlements`, `games`, and `players` before
each test. `LOG_LEVEL=silent` is set by the Vitest config.

### Docker locally

```bash
cp .env.example .env
# fill in values; for local HTTP set COOKIE_SECURE=false
docker compose -f docker-compose.yml -f docker-compose.debug.yml up -d --build db web
docker compose ps
curl -sS http://127.0.0.1:3100/api/health
```

This starts only `db` and `web`. `cloudflared` needs a real `TUNNEL_TOKEN`; do not start it locally
with the placeholder. The debug override publishes only `127.0.0.1:3100` (web) and
`127.0.0.1:5433` (db). The base compose file publishes nothing.

## Environment variables and secrets

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | `production` in Docker; `development`/`test` locally |
| `PORT` | no | Default `3000` |
| `TZ` | yes | Must be `Asia/Hong_Kong`; validated at startup |
| `LOG_LEVEL` | no | pino level; default `info`, tests use `silent` |
| `DATABASE_URL` | yes | `postgres://user:pass@db:5432/tally` inside compose |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | yes | Used by the `db` container |
| `APP_PASSCODE` | yes | Shared passcode; **≥32 characters in production** |
| `SESSION_SECRET` | yes | HMAC key; **≥32 characters**; rotating it invalidates all sessions |
| `COOKIE_SECURE` | no | Default `true`; set `false` only for plain-HTTP local development |
| `TUNNEL_TOKEN` | yes (deploy) | Cloudflare Named Tunnel token |

`POSTGRES_PASSWORD` and the password inside `DATABASE_URL` must be identical. If you choose a
password with special characters, URL-encode it inside `DATABASE_URL`; the `openssl rand -hex 32`
output is URL-safe.

Generate secrets with:

```bash
openssl rand -hex 32
```

Keep `.env` at mode `600` on the host (`chmod 600 .env`). `.env`, `data/*.json`, and `backups/` are
gitignored. The application never logs the passcode, session cookie, or database URL.

## Migrations

`migrations/*.sql` are applied in filename order by `src/migrate.ts`:

- creates `schema_migrations(version, applied_at)` if missing;
- takes a PostgreSQL advisory lock so concurrent starts cannot race;
- applies each missing file inside its own transaction and records the version;
- is safe to rerun (verified by running it twice).

The initial migration creates `players`, `games`, `settlements`, and the indexes on
`games.played_at` and `settlements.player_id`. `games.external_id` is unique for idempotent imports.
`gen_random_uuid()` is built into PostgreSQL 16.

## API contract

All responses are JSON except `204 No Content`. Errors use:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "未授權" } }
```

Codes: `UNAUTHORIZED` (401), `VALIDATION` (400), `NOT_FOUND` (404), `CONFLICT` (409),
`RATE_LIMITED` (429), `UNSUPPORTED_MEDIA_TYPE` (415), `PAYLOAD_TOO_LARGE` (413), `INTERNAL` (500).
Messages may be Traditional Chinese; **codes are the contract**.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth` | no | `{ passcode }` → `204` + `Set-Cookie: mj_session=...` |
| `POST` | `/api/auth/logout` | no | Clears the cookie → `204` |
| `GET` | `/api/health` | no | `{ ok, db }`, `Cache-Control: no-store` |
| `GET` | `/api/records?limit=&cursor=` | yes | Newest first, keyset pagination |
| `POST` | `/api/records` | yes | Create one game + N settlements |
| `PATCH` | `/api/records/:id` | yes | Update date and/or replace settlements |
| `DELETE` | `/api/records/:id` | yes | Delete game; settlements cascade |
| `GET` | `/api/players` | yes | `{ players: [{ id, name }] }`, name asc |
| `GET` | `/api/stats?player=&year=` | yes | Full-dataset player stats |
| `GET` | `/api/ranking` | yes | Full-dataset ranking |

### Auth

`POST /api/auth` accepts `{ "passcode": "..." }` and returns `204` with:

```
Set-Cookie: mj_session=<base64url(payload)>.<base64url(HMAC-SHA256)>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000
```

The token payload is `{ v: 1, iat, exp }` with a 30-day expiry. The token is never returned in the
body. Passcode comparison is constant-time (SHA-256 + `timingSafeEqual`). Wrong passcode, malformed
body, and missing cookie all return the same `401 UNAUTHORIZED` response. `POST /api/auth` is rate
limited to 5 requests per 60 seconds per client IP (`CF-Connecting-IP` when present, otherwise
`req.ip`); the sixth returns `429` with `Retry-After`.

### Records

`GET /api/records?limit=50&cursor=<opaque>`:

```json
{
  "items": [
    {
      "id": "uuid",
      "date": "YYYY-MM-DD",
      "recordedAt": "ISO-8601",
      "players": [{ "playerId": "uuid", "name": "string", "score": 12.5 }]
    }
  ],
  "nextCursor": "opaque-or-null"
}
```

Sort order is `played_at desc, recorded_at desc, id desc`. `limit` is 1–200 (default 50). Players
are ordered by `name asc`. The cursor is an opaque base64url value; an invalid cursor returns
`400 VALIDATION`.

`POST /api/records`:

```json
{
  "date": "YYYY-MM-DD",
  "players": [
    { "name": "閒1", "score": 12.5 },
    { "name": "閒2", "score": -12.5 },
    { "name": "閒3", "score": 0 },
    { "name": "我", "score": 0 }
  ]
}
```

`date` defaults to Hong Kong today. Exactly 4 unique names, each 1–7 Unicode code points after
trimming. Scores must be finite and are rounded to 1 decimal place. Existing players are reused by
name. Returns `201` with the created item.

`PATCH /api/records/:id` accepts `date` and/or `players` (at least one). `players` must contain 2–8
entries and replaces the settlement set. An entry with `playerId` must currently belong to the game
(otherwise `400`). If its `name` differs, the player is **renamed globally** (`players.name`), so
history follows automatically; renaming to another player's name returns `409 CONFLICT`. An entry
without `playerId` reuses a player by name or creates one. Duplicate players in the same record
return `409`. Returns `200` with the updated item.

`DELETE /api/records/:id` returns `204`; settlements cascade. Missing records return `404`.

### Stats

`GET /api/stats?player=<name>&year=<YYYY>` (year defaults to the current Hong Kong year):

```json
{
  "player": "閒1",
  "year": 2026,
  "yearTotal": 14,
  "yearGames": 6,
  "yearWins": 3,
  "winRate": 50,
  "best": { "score": 20, "date": "2025-12-31" },
  "worst": { "score": -5, "date": "2026-02-10" },
  "avgWin": 10.4,
  "avgLoss": -3.7,
  "allTimeGames": 7
}
```

Win = `score > 0`; the denominator is all of that player's games in the year (zero and negative
scores count as non-wins). `best`/`worst` are all-time and tie-break on earliest `played_at`, then
earliest `recorded_at`. `avgWin`/`avgLoss` are all-time averages of positive/negative scores.
Unknown players return `200` with zeros and nulls.

### Ranking

`GET /api/ranking`:

```json
{
  "ranking": [
    { "playerId": "uuid", "name": "閒1", "total": 34, "wins": 4, "losses": 2, "games": 7 }
  ]
}
```

All-time, full dataset, `total desc` then `name asc`. Players with at least one settlement are
included. Totals are rounded to 1 decimal place.

### Static serving

`public/` is served at `/`; `/` maps to `index.html`. Non-API GET paths without a dot fall back to
`index.html` for SPA routing. `manifest.webmanifest` is served as `application/manifest+json`;
`sw.js`, `index.html`, and `manifest.webmanifest` use `Cache-Control: no-cache`; `/assets/*` uses a
long immutable cache; `/api/*` uses `no-store`. Unknown `/api/*` returns a JSON `404`.

## Firebase import

The export file is not committed. Put it under `data/` (gitignored) and run the importer inside the
web container:

```bash
mkdir -p data
# copy the Firebase RTDB export to data/export.json

docker compose exec -T web node scripts/import-firebase-json.mjs /app/data/export.json --dry-run
docker compose exec -T web node scripts/import-firebase-json.mjs /app/data/export.json
docker compose exec -T web node scripts/import-firebase-json.mjs /app/data/export.json --verify
```

The importer runs as the container's `node` user (UID 1000). The export must be readable by that
UID; `chmod 644 data/export.json` is the simplest (then `chmod 600` it again after the import).

Behavior:

- accepts `{ "records": { ... } }` or a root object keyed by timestamp/push id;
- one record → one `games` row + N `settlements`;
- `external_id` is the original key, so reruns skip existing records (`ON CONFLICT DO NOTHING`);
- `played_at` uses `date` when valid, otherwise the Hong Kong date derived from `timestamp` or a
  numeric key;
- `recorded_at` uses the numeric timestamp when available, otherwise `now()`;
- empty `players` and non-finite scores are skipped with a warning; all-zero records are imported;
- player names are used raw (no sanitization); names containing `_` are printed for manual review;
- one transaction per record; a bad record logs a warning and the import continues;
- the report prints inserted/skipped/warnings counts and 5 JSON-vs-DB samples;
- `--verify` compares the JSON's expected per-player totals with the SQL aggregate and exits `1` if
  any difference exceeds `0.05`.

`--verify` still runs the idempotent import first, then compares the whole database against the
supplied JSON. Run it on an import-only database, or expect differences from records created through
the API after the import.

## Backup and restore

### Daily backup

`scripts/backup.sh` runs `pg_dump` inside the `db` container, gzips the output to
`backups/tally-<HK timestamp>.sql.gz` with mode 600, and keeps the newest 14 files.

Host cron line (04:17 Hong Kong daily):

```cron
CRON_TZ=Asia/Hong_Kong
17 4 * * * cd /home/funnywai/Tally && ./scripts/backup.sh >> backups/backup.log 2>&1
```

`CRON_TZ` is supported by cronie. On Ubuntu's default cron, set the host timezone to
`Asia/Hong_Kong` (or schedule `17 20 * * *` if the host clock is UTC) and verify with `date`.

### Restore

```bash
./scripts/restore.sh backups/tally-YYYYMMDD-HHMMSS.sql.gz --yes
```

The script refuses to run without `--yes`, stops `web`, drops and recreates the `public` schema,
pipes the dump through `psql`, and starts `web` again. Migrations reapply on startup if
`schema_migrations` was dropped.

**Tested restore evidence (local Docker stack, 2026-10-21):** a marker record was created, backed
up, deleted through the API, and restored. `GET /api/records` returned the marker again and
`GET /api/health` returned `{"ok":true,"db":true}`. Backup files are gitignored, so the exact dump
is not committed.

## Deployment

Target host: `/home/funnywai/Tally` on the self-hosted Ubuntu machine. Do not touch the unrelated
`worldcup` stack, its network, volume, `.env`, or tunnel token.

First deploy:

```bash
cd /home/funnywai/Tally
cp .env.example .env
# Generate POSTGRES_PASSWORD, APP_PASSCODE, SESSION_SECRET; keep the DATABASE_URL password identical.
chmod 600 .env
# Create the Named Tunnel and set TUNNEL_TOKEN in .env before starting cloudflared.
docker compose up -d --build
docker compose ps
curl -fsS https://tally.funnywai.tech/api/health
```

Subsequent deploys:

```bash
cd /home/funnywai/Tally
git pull
docker compose up -d --build
docker compose ps
curl -fsS https://tally.funnywai.tech/api/health
```

The base compose file publishes no ports. `web` waits for `db` to be healthy; `cloudflared` waits
for `web` to be healthy. All services use `restart: unless-stopped` and json-file logging capped at
10 MB × 3 files.

### Cloudflare Named Tunnel

1. Cloudflare dashboard → Zero Trust → Networks → Tunnels → **Create a tunnel** → Cloudflared.
2. Name it `tally` (separate from the `worldcup` tunnel).
3. Copy the tunnel token into `.env` as `TUNNEL_TOKEN`.
4. Add a **Public Hostname**: subdomain `tally`, domain `funnywai.tech`, service
   `http://web:3000`.
5. Start the stack: `docker compose up -d`.
6. Verify: `curl -I https://tally.funnywai.tech` and `curl -sS https://tally.funnywai.tech/api/health`.

Do **not** use a Quick Tunnel (`trycloudflare.com`): the hostname changes on restart and breaks the
installed PWA's `start_url`. HTTPS is provided by Cloudflare, which is required for the `Secure`
session cookie.

## Security notes

- Single shared passcode; no accounts, roles, or per-user permissions.
- Session token lives only in an `HttpOnly` cookie; JavaScript cannot read it. No `Authorization`
  header and no token in response bodies.
- `SameSite=Lax` plus JSON-only state-changing requests mitigates CSRF without a separate token.
- Rate limit: 5 login attempts per 60 seconds per IP. The limiter is in-memory and resets on
  restart; this is acceptable for a single-instance, single-ledger deployment.
- Sessions are stateless. Logout clears the cookie; a copied token remains valid until its 30-day
  expiry. Rotate `SESSION_SECRET` to invalidate every session immediately.
- Security headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`,
  `X-Frame-Options: DENY`; `X-Powered-By` is disabled.
- JSON body limit is 32 KB; non-JSON bodies on state-changing requests return `415`.
- All SQL is parameterized. Player names are data, not HTML; the Phase B frontend must escape them
  when rendering.
- `db` is never published. Only `cloudflared` exposes `web`.
- Backups contain personal data. Keep `backups/` private and out of git.

## Backend design decisions

- **Express 5 + `pg` + raw SQL.** The schema is small and the aggregation queries are explicit;
  an ORM would add indirection without removing meaningful complexity.
- **Normalized ledger.** One `games` row + N `settlements`; player history is derived by query, so
  a global rename is a single `players.name` update. This removes the Firebase double-write and
  manual history migration.
- **Keyset pagination.** Tuple comparison on `(played_at, recorded_at, id)` avoids offset drift and
  keeps the index useful. `recorded_at` is `timestamptz(3)` so JavaScript `Date` round-trips exactly
  in the cursor.
- **Full-dataset stats/ranking.** Aggregations run in SQL over all settlements; there is no
  200-record cap.
- **Hong Kong time.** Dates are computed with `Intl.DateTimeFormat` in `Asia/Hong_Kong`, and the pg
  pool sets `timezone=Asia/Hong_Kong`. `played_at` is a `date`, so year filtering is unambiguous.
- **Stateless HMAC sessions.** No session table; the cookie is self-contained and signed with
  `SESSION_SECRET`. This keeps the deployment simple and makes secret rotation the revocation
  mechanism.
- **Idempotent import.** `games.external_id` is unique; rerunning the importer is safe and
  `--verify` reconciles totals against the source JSON.
- **Startup resilience.** The server retries the database connection 10 times at 2-second intervals
  before failing, then applies migrations under an advisory lock.

## Out of scope (Phase B)

- Frontend UI, three workflows, localStorage draft state, PWA manifest/icons/service worker,
  install guidance, safe-area handling, and visual design.
- Multi-ledger, groups, user accounts, roles, or per-user permissions.
- Server-side session revocation/denylist and distributed rate limiting.
- A backup sidecar container; the host cron line above is the documented mechanism.
