# Tally — Mahjong & Football

Self-hosted Mahjong scoring app. This repository contains **Phase A (infrastructure + backend)** and
**Phase B (React PWA frontend)**. The frontend lives in `frontend/`; the Docker image builds it into
the runtime `public/` directory.

- Backend: Node.js 22 + Express 5 + raw PostgreSQL (`pg`) + Zod 4 + TypeScript 5.9
- Frontend: Vite 8 + React 19 + TypeScript 5.9 + `vite-plugin-pwa`; system CJK fonts only
- Package manager: pnpm (root backend and standalone `frontend/` package)
- Tests: Vitest (backend unit + integration against PostgreSQL 16; frontend pure-logic unit tests)
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
                              └── public/ (built frontend from frontend/dist)
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
frontend/
  src/                      React app (pages, components, state, lib, styles)
  public/                   PWA icons, maskable icons, apple-touch-icon, startup images
  tests/                    Vitest unit tests for scoring, money, dates, reducer, storage
  DESIGN.md                 Phase B design-system contract (tokens, components, motion, a11y)
  vite.config.ts            Vite + PWA config; dev proxy to 127.0.0.1:3100
scripts/
  import-firebase-json.mjs  idempotent Firebase RTDB import + --verify
  backup.sh                 pg_dump + gzip + keep newest 14
  restore.sh                drop/recreate public schema + restore
  smoke-test.sh             end-to-end curl proof
tests/                      Vitest unit + integration tests and fixtures
docs/api.http               REST Client examples for every endpoint
docs/evidence/phase-b/      Local Phase B screenshots and E2E result JSON (gitignored)
public/                     Phase A placeholder (the Docker image replaces it with frontend/dist)
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

### Frontend development

The Vite dev server proxies `/api` to the local Docker backend at `http://127.0.0.1:3100`, so start
the backend first (`docker compose -f docker-compose.yml -f docker-compose.debug.yml up -d db web`).

```bash
pnpm --dir frontend install
pnpm dev:web          # Vite at http://127.0.0.1:5173
pnpm build:web        # production build into frontend/dist
pnpm typecheck:web
pnpm test:web
```

The frontend is a standalone pnpm package with its own `frontend/pnpm-lock.yaml`. It uses hash routes
(`#fan`, `#mai`, `#ledger`), same-origin `fetch` with `credentials: "same-origin"`, and never stores
the passcode or session token in `localStorage`.

### Tests

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm typecheck:web
pnpm test:web
```

Integration tests use `TEST_DATABASE_URL`, defaulting to
`postgres://tally:test@127.0.0.1:5433/tally_test`. The database name must end with `_test`; the test
helper refuses to run otherwise, so a shell that loaded a production `DATABASE_URL` cannot make
`pnpm test` truncate production tables. Tests truncate `settlements`, `games`, and `players` before
each test. `LOG_LEVEL=silent` is set by the Vitest config.

When the Docker debug stack already owns `127.0.0.1:5433`, create a separate `tally_test` database in
that PostgreSQL instance and point `TEST_DATABASE_URL` at it with the same credentials as `.env`:

```bash
set -a; . ./.env; set +a
docker exec -e PGPASSWORD="$POSTGRES_PASSWORD" tally-db-1 \
  psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE tally_test"
TEST_DATABASE_URL="postgres://$POSTGRES_USER:$POSTGRES_PASSWORD@127.0.0.1:5433/tally_test" pnpm test
```

The frontend tests are pure-logic Vitest tests (no browser): scoring formula, 踢半, 找數 zero-sum,
特別賞罰, 飯錢, money formatting, Hong Kong date grouping, reducer/undo, and localStorage validation.

### Docker locally

```bash
cp .env.example .env
# fill in values; for local HTTP set NODE_ENV=development and COOKIE_SECURE=false
docker compose -f docker-compose.yml -f docker-compose.debug.yml up -d --build db web
docker compose ps
curl -sS http://127.0.0.1:3100/api/health
```

This starts only `db` and `web`. `cloudflared` needs a real `TUNNEL_TOKEN`; do not start it locally
with the placeholder. The debug override publishes only `127.0.0.1:3100` (web) and
`127.0.0.1:5433` (db). The base compose file publishes nothing. Because production rejects
`COOKIE_SECURE=false`, local Docker must also set `NODE_ENV=development` in `.env`.

The `web` image is a multi-stage build: a `web-build` stage installs `frontend/`, runs
`pnpm build`, and the runtime stage copies `frontend/dist` to `/app/public`. The runtime image no
longer contains the Phase A placeholder.

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
| `PUBLIC_DIR` | no | Static directory; default `public`. Set `PUBLIC_DIR=frontend/dist` for local production-like serving without Docker |
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
`gen_random_uuid()` is built into PostgreSQL 16. A second migration adds a composite
`(played_at desc, recorded_at desc, id desc)` index for keyset pagination.

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
| `POST` | `/api/auth/logout` | no | Requires `Content-Type: application/json`; clears the cookie → `204` |
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

`POST /api/auth/logout` requires `Content-Type: application/json` (body may be `{}`); this blocks a
cross-site HTML form from clearing the session cookie.

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
(otherwise `400`). If its `name` differs, the player is **renamed globally** (`players.name`) when the
new name does not exist. If the new name exists only in other records, the source player is **merged
into the target**: settlements are reassigned and the orphan source player row is removed. If the
source and target share any record/game, the request returns `409 CONFLICT` and nothing is changed;
same-record duplicates are never merged or summed. An entry without `playerId` reuses a player by
name or creates one; two entries without `playerId` and the same name return `409 CONFLICT`. If
multiple entries resolve to the same player, the request returns `409 CONFLICT` instead of summing
their scores. Returns `200` with the updated item.

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

`public/` is served at `/`; `/` maps to `index.html`. `PUBLIC_DIR` overrides the directory (for
example `PUBLIC_DIR=frontend/dist pnpm start:local`). Non-API GET paths without a dot fall back to
`index.html` for SPA routing. `manifest.webmanifest` is served as `application/manifest+json`;
`sw.js`, `index.html`, and `manifest.webmanifest` use `Cache-Control: no-cache`; `/assets/*` uses a
long immutable cache; `/api/*` uses `no-store`. Unknown `/api/*` returns a JSON `404`.

## Phase B frontend

The frontend is a mobile-first React PWA for four friends scoring at a table. It has three workflows:

- **番數記錄** (`#fan`) — 3 columns × 7 rows, row-major; the formula is
  `ceil(Σ r_i · 1.5^(n-1-i))` over non-null cells, top to bottom; 踢半 and 找數 per column.
- **埋數** (`#mai`) — four player cards, decimal adjust keypad, ÷4/÷3/÷2, 特別賞罰, 飯錢, and
  「寫入小氣簿」.
- **小氣簿** (`#ledger`) — paginated history with per-record edit/delete, full-dataset personal
  stats, and full-dataset ranking.

The design contract is [`frontend/DESIGN.md`](frontend/DESIGN.md). The direction is **“Mahjong table
at night”**: deep ink-green felt, warm ivory type, cinnabar seal accent, jade/coral money semantics,
and a tally-mark identity. Layer A is `taste-skill` (density, anti-slop discipline); Layer B is
`supabase` (border-defined dark surfaces, translucent layering, pill primary CTA). No external fonts,
CDNs, logos, or brand copy are used.

### Auth and state

- Shared passcode → `POST /api/auth` → server sets an `HttpOnly` cookie. The frontend never stores
  the passcode or token, never adds an `Authorization` header, and always uses
  `credentials: "same-origin"`.
- Boot probe is `GET /api/players`: `200` = authenticated, `401` = login, network/5xx = offline mode
  with retry. Any API `401` returns to the login screen.
- Today's draft lives in `localStorage` under exactly `mj_names`, `mj_inputs`, `mj_outputs`,
  `mj_tikai`, `mj_accumulated`, `mj_undo_stack`. The server is the ledger truth; localStorage is only
  the current day's draft. The install banner's dismissal uses `tally_install_dismissed_v1`; it is a
  UI preference only, never a session or token.

### PWA

- `manifest.webmanifest`: `name: "Tally — Mahjong & Football"`, `short_name: "Tally"`,
  `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `lang: "zh-Hant"`, 192/512 + maskable
  icons.
- Opaque 180×180 `apple-touch-icon`, 10 `apple-touch-startup-image` sizes, `black-translucent`
  status bar, `viewport-fit=cover`, `100dvh`, top and bottom safe areas, 16px inputs, no
  `maximum-scale`.
- Service worker precaches the app shell; HTML/SW are network-first; `/api/*` is `NetworkOnly` and
  never cached. Offline reload still opens the fan/mai pages; the ledger shows an offline/error state
  with retry.
- iOS Safari (not standalone) shows a dismissible “Safari 分享 → 加入主畫面” banner. The update
  banner uses `virtual:pwa-register/react` `needRefresh` with 「更新」/「稍後」.

### Evidence

Local QA screenshots and E2E result JSON are in
[`docs/evidence/phase-b/`](docs/evidence/phase-b/) (gitignored; generated on the build machine). Key
files:

- `375-login.png`, `375-fan-empty.png`, `375-fan-filled.png`, `375-keypad.png`,
  `375-fan-tikai.png`, `375-fan-zhao.png`
- `375-mai.png`, `375-mai-adjusted.png`, `375-special.png`, `375-food.png`,
  `375-mai-written.png`
- `375-ledger-history.png`, `375-edit-record.png`, `375-delete-record.png`,
  `375-ledger-stats.png`, `375-ledger-ranking.png`
- `375-offline.png`, `375-reduced-motion.png`, `430-login.png`, `430-fan.png`, `430-mai.png`,
  `430-ledger.png`
- `prod-login.png`, `prod-fan.png`, `prod-mai.png`, `prod-ledger.png`,
  `prod-offline-reload.png`, `prod-401-login.png`
- `ios-install-banner.png`, `ios-standalone.png`
- `e2e-results.json`, `prod-results.json`, `prod-flow-results.json`

### Known limitations

- Real iPhone standalone/safe-area evidence is still pending; the captured iOS evidence uses
  Playwright WebKit with an iPhone user agent, not a physical device.
- No Web Push, background sync, or offline write queue (out of scope per the spec).
- Dark-only theme by design; no desktop layout beyond the centred 480px shell.
- The service worker update prompt is implemented but a real redeploy/update cycle still needs
  device verification.

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
17 4 * * * cd /home/funnywai/Tally && mkdir -p backups && ./scripts/backup.sh >> backups/backup.log 2>&1
```

`CRON_TZ` is supported by cronie. On Ubuntu's default cron, set the host timezone to
`Asia/Hong_Kong` (or schedule `17 20 * * *` if the host clock is UTC) and verify with `date`.
The `mkdir -p backups` is required on a fresh clone because `backups/` is gitignored and the shell
sets up the log redirect before `backup.sh` runs.

### Restore

```bash
./scripts/restore.sh backups/tally-YYYYMMDD-HHMMSS.sql.gz --yes
```

The script refuses to run without `--yes`, verifies the gzip archive, stops `web`, drops and
recreates the `public` schema, pipes the dump through `psql`, and starts `web` again. If the restore
fails, `web` remains stopped so it cannot serve an empty schema. Migrations reapply on startup if
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
7. Add a **Cache Rule** for `tally.funnywai.tech` so `/sw.js`, `/index.html`,
   `/manifest.webmanifest`, and `/api/*` bypass Cloudflare's default Browser Cache TTL. Without it,
   Cloudflare rewrites `sw.js` to `Cache-Control: max-age=14400`, which delays service-worker
   updates. Verify: `curl -sS -D - https://tally.funnywai.tech/sw.js -o /dev/null | grep -i cache-control`
   must not show `max-age=14400`.

Do **not** use a Quick Tunnel (`trycloudflare.com`): the hostname changes on restart and breaks the
installed PWA's `start_url`. HTTPS is provided by Cloudflare, which is required for the `Secure`
session cookie.

## Security notes

- Single shared passcode; no accounts, roles, or per-user permissions.
- Session token lives only in an `HttpOnly` cookie; JavaScript cannot read it. No `Authorization`
  header and no token in response bodies.
- `SameSite=Lax` plus JSON-only state-changing requests mitigates CSRF without a separate token.
- Rate limit: 5 login attempts per 60 seconds per IP. The limiter is in-memory and resets on
  restart; this is acceptable for a single-instance, single-ledger deployment. `CF-Connecting-IP` is
  trusted because `web` publishes no port and is reachable only through `cloudflared`; keep it that
  way (the debug override is loopback-only).
- Sessions are stateless. Logout clears the cookie; a copied token remains valid until its 30-day
  expiry. Rotate `SESSION_SECRET` to invalidate every session immediately.
- Security headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`,
  `X-Frame-Options: DENY`; `X-Powered-By` is disabled.
- JSON body limit is 32 KB; non-JSON bodies on state-changing requests return `415`.
- All SQL is parameterized. Player names are data, not HTML; the React frontend renders them as text
  (no `dangerouslySetInnerHTML`).
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

## Out of scope

- Multi-ledger, groups, user accounts, roles, or per-user permissions.
- Server-side session revocation/denylist and distributed rate limiting.
- A backup sidecar container; the host cron line above is the documented mechanism.
- Web Push, background sync, and an offline write queue.
- Real-device iPhone evidence (pending; see the Phase B known limitations).
