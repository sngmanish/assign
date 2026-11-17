# CRM Contact Workspace

A contact workspace for a CRM: search, filter, sort and page through contacts, edit them safely when several people are working at once, tag them (one at a time or in bulk), and see an activity history.

This repository is a monorepo:

| Folder | What | Status |
| --- | --- | --- |
| `backend/` | REST API (Fastify, Kysely, Postgres), migrations, seed script, tests | Done |
| `frontend/` | Web UI | Not started (separate spec) |
| `docs/backend-spec.md` | The backend spec this implementation follows | |

Contents: [Run it](#run-it) · [Deploying to Railway](#deploying-to-railway-manual-via-dashboard) · [Tech stack](#tech-stack) · [API](#api) · [Key decisions](#key-decisions) · [Data model](#data-model) · [Concurrency](#concurrency-approach) · [Pagination and the capped count](#pagination-and-the-capped-count) · [Tests](#tests) · [Known issues](#known-issues) · [Scale notes](#scale-notes) · [AI usage](#ai-usage)

---

## Run it

**Prerequisites:** Node.js 20 or newer, Docker (for Postgres).

```bash
# 1. Configuration (defaults work as-is)
cp .env.example .env

# 2. Start Postgres (creates the `crm` and `crm_test` databases on first start)
docker compose up -d

# 3. Install, migrate, seed, run
cd backend
npm install
npm run migrate        # applies the schema
npm run seed           # ~20,000 generated contacts, about a second
npm run dev            # API on http://localhost:3000
```

Check it:

```bash
curl localhost:3000/health
curl "localhost:3000/contacts?q=patel&sort=name&limit=5"
```

Notes:

- **Port 5432 already in use** (for example a local Postgres)? Set `POSTGRES_PORT=5433` in `.env` and change the port in `DATABASE_URL` and `TEST_DATABASE_URL` to match, then `docker compose up -d`.
- The backend reads the repo-root `.env` for local development. In a hosted environment, real environment variables are used instead.
- `crm_test` is only created the first time the Postgres volume is initialised. If you already had a volume, create it by hand: `docker compose exec postgres psql -U postgres -c 'CREATE DATABASE crm_test'`.
- On start, the server applies any pending migrations and then, **only if the contacts table is empty**, seeds 20,000 demo contacts, before it begins listening. A restart never adds to or overwrites data. Set `SEED_ON_START=false` to skip it. (`npm run seed` is still there for custom sizes, e.g. `-- --count 1000000 --reset`.)

### Environment variables

| Variable | Purpose | Default (local only) |
| --- | --- | --- |
| `DATABASE_URL` | Postgres connection string. Required when `NODE_ENV=production`. | `postgres://postgres:postgres@localhost:5432/crm` |
| `TEST_DATABASE_URL` | Database the tests run against. Tests wipe its tables. | `…/crm_test` |
| `PORT` | HTTP port | `3000` |
| `CORS_ORIGIN` | Allowed browser origin(s), comma separated (spaces are ignored). **Required when `NODE_ENV=production`**; CORS is off if unset locally. | unset |
| `DATABASE_SSL` | `true` or `false`. Forces SSL on or off for the database connection. | SSL on when `NODE_ENV=production`, off otherwise |
| `SEED_ON_START` | `true` or `false`. Seed demo contacts on start if the table is empty. | `true` |
| `DATABASE_CA_CERT` | PEM of the database's CA. When set, the TLS certificate is **verified**; without it the connection is encrypted but the certificate is not checked. Literal `\n` is accepted for newlines. | unset |
| `STATEMENT_TIMEOUT_MS` | Server-side cap on a single request's query. Postgres cancels it, and the API answers 503. | `10000` |
| `RATE_LIMIT_MAX` | Requests per minute per client. `/health` and `/docs` are exempt. | `300` |
| `RATE_LIMIT_BULK_MAX` | Requests per minute per client for `POST /tags/bulk-assign` | `20` |
| `TRUST_PROXY_HOPS` | How many proxies sit in front of the API (0 to 5). The client address is the one the nearest proxy appended to `X-Forwarded-For`; anything a client writes before it is ignored. `1` on Railway (check it, see below). **Never "trust everything"**: that lets a client choose its own address and bypass the rate limit. The old `TRUST_PROXY` setting is refused at start. | `0` |
| `ENABLE_DOCS` | `true` or `false`. Serve Swagger UI and the OpenAPI document at `/docs`. | `true` |
| `POSTGRES_PORT` | Host port for the Docker Postgres | `5432` |

The limiter is in memory, so limits are per instance. It is off in the test suite unless a test turns it on.

### npm scripts (in `backend/`)

| Script | What it does |
| --- | --- |
| `npm run dev` | Run with auto-reload (`tsx watch`) |
| `npm run build` / `npm start` | Compile to `dist/` / run the compiled server |
| `npm test` | Run all tests against the real test database |
| `npm run migrate` | Apply pending migrations |
| `npm run seed` | Seed 20,000 contacts. Refuses if contacts already exist. |
| `npm run seed -- --count 1000000 --reset` | Wipe and reseed, for local scale testing. Also takes `--seed N` (default 42). |
| `npm run lint` / `format` / `typecheck` | Lint, format with Prettier, type-check |

### Project layout

```
backend/
  src/
    index.ts          start-up: migrate, then listen
    app.ts            builds the Fastify app (CORS, error handling, routes)
    config.ts         environment handling
    errors.ts         the shared error shape and request parsing helpers
    routes/           HTTP routes: contacts.ts, tags.ts
    contacts/         list/search/pagination (list.ts, cursor.ts), update.ts, activities.ts, queries.ts
    tags/             service.ts (single tag changes), bulk.ts (bulk assign)
    db/               Kysely setup, migration runner, migrations/, seed.ts
  tests/              Vitest tests, run against a real Postgres database
```

---

## Deploying to Railway (manual, via dashboard)

The API deploys to [Railway](https://railway.com) from this repo, with the frontend on Vercel. Everything below is done by hand in the web dashboards. Nothing in this repo deploys for you, and no CLI is needed.

**What the backend does on start:** applies pending migrations, seeds 20,000 contacts if the contacts table is empty, then listens. So there are no manual commands after deploying.

1. **Create a project** at railway.com: **New Project** → **Deploy PostgreSQL**. Leave the Postgres service as it is.
2. **Add the backend:** in the project click **New** → **GitHub Repo** and choose this repo.
3. In the new service's **Settings**:
   - **Root Directory:** `backend`
   - **Build command:** `npm ci && npm run build`
   - **Start command:** `npm start`
   - **Healthcheck path:** `/health`
4. **Variables** (service → **Variables**):

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Add a **reference** to the Postgres service's `DATABASE_URL`, i.e. `${{Postgres.DATABASE_URL}}` |
   | `CORS_ORIGIN` | The Vercel domain, e.g. `https://your-app.vercel.app` (no trailing slash; comma-separate several). **The server refuses to start without it in production.** |
   | `NODE_ENV` | `production` (turns SSL on for the database connection) |
   | `TRUST_PROXY_HOPS` | `1`: Railway's edge is one proxy in front of the API, so each visitor gets their own rate limit instead of everyone sharing the proxy's address. **Check it after the first deploy**, see below. |

   `PORT` is set by Railway itself, so don't add it. If the logs show an SSL or connection error, set `DATABASE_SSL` to `true` or `false` to force it. By default the connection is encrypted but the database's certificate is not verified (`rejectUnauthorized: false`), because managed Postgres commonly uses a self-signed certificate and the Railway reference URL uses its private network. To verify it, paste the CA certificate into `DATABASE_CA_CERT`; the server logs a warning at start while verification is off.
5. **Expose it:** service → **Settings** → **Networking** → **Generate Domain**.
6. **Deploy** (Railway also redeploys on every push) and open **Deployments → View logs**. Expect `startup: applied 001_init, 002_activity_actor; seeded demo contacts`, then `Server listening`.
7. **Check it on the live URL:**

   ```bash
   curl https://<your-domain>/health
   # {"status":"ok","db":"up"}
   curl "https://<your-domain>/contacts?q=patel&limit=5"
   # items, and "total": "10000+" with "capped": true while all 20,000 rows are in
   ```
8. **Connect the frontend:** set the live API URL as the API base URL in Vercel, then set `CORS_ORIGIN` here to the final Vercel domain.

**Check the proxy hop count once, after deploying.** The first request that carries an `X-Forwarded-For` header (health probes do not) logs one line: `client address resolved from X-Forwarded-For`, with `ip`, `xForwardedFor` and `hops`. Open it in the Railway logs and make sure `ip` is **your own public address** (use any "what is my IP" page). If `ip` is a Railway-internal address, the hop count is too low (raise it); if it is a value you can change by sending your own `X-Forwarded-For` header, it is too high (lower it). I could not verify Railway's proxy chain from here, so this check is part of deploying.

**Live API:** _add the URL here after deploying_

**If something goes wrong**

| Symptom | Likely cause |
| --- | --- |
| Build deploys the wrong thing or fails to find `package.json` | Root Directory is not `backend` |
| Boots, then `DATABASE_URL is required` | The variable is missing or the reference is misspelled |
| SSL or "connection terminated" errors | Try `DATABASE_SSL=true` (or `false`) |
| Browser CORS errors | `CORS_ORIGIN` differs from the page's origin (trailing slash, `http` vs `https`). Spaces after commas are fine. |
| `CORS_ORIGIN is required` in the logs | Set it; production refuses to start without it |
| 429 `RATE_LIMITED` for everyone at once | `TRUST_PROXY_HOPS` is 0, so all visitors share the proxy's address |
| Rate limit does not seem to apply per visitor | `TRUST_PROXY_HOPS` is too high, so the address a visitor wrote is believed (see the check below) |
| Contacts list is empty | `SEED_ON_START=false` is set, or the table already had rows from earlier |

The SSL behaviour could only be tested locally against a database without SSL, so it is unverified against Railway's Postgres until the first deploy.

---

## Tech stack

- **Node.js + TypeScript** (strict mode, ES modules)
- **Fastify 5** for HTTP
- **Postgres 16** in Docker Compose, with the `pg_trgm` extension
- **Kysely** as a type-safe query builder: no ORM, plain SQL semantics, versioned migrations
- **Zod 4** for request validation, also the source of the OpenAPI document
- **@fastify/swagger** and **@fastify/swagger-ui** for the interactive API docs at `/docs`
- **Vitest** for tests, against a real Postgres database (no mocks of the database)
- ESLint + Prettier

---

## API

**Interactive docs (Swagger UI): `/docs`** (for example http://localhost:3000/docs), with the raw OpenAPI 3.1 document at `/docs/json`. You can try every endpoint from the page. The tables below are the same information in prose.

How it is built: the request schemas are the same Zod schemas the handlers validate with, attached to each route and converted to OpenAPI. Fastify's own validation stays off, so the 400 versus 422 error shapes are exactly as described below; the attached schemas are documentation only. Response schemas are written next to them, type-checked against the response types, and a test compares real responses with the generated document key for key, so the docs cannot silently drift. The docs page is public, like everything else (see [Known issues](#known-issues)).

No authentication: every endpoint is public (see [Known issues](#known-issues)). All JSON is camelCase.

Optional header `X-Actor: <display name>` labels who made a change (a demo "acting as" name, see [Try the conflict scenario](#try-the-conflict-scenario)). It is trimmed and must be 1 to 50 characters. If it is missing or invalid the request still works and is recorded as `Anonymous`.

| Method and path | Purpose |
| --- | --- |
| `GET /health` | 200 when Postgres answers, 503 otherwise |
| `GET /contacts` | List with search, filters, sorting and pagination |
| `GET /contacts/:id` | One contact with its tags and `version` |
| `PATCH /contacts/:id` | Update fields. Requires the `version` you started from. |
| `GET /contacts/:id/activities?limit=20` | Recent activity, newest first (limit 1 to 100) |
| `GET /tags?limit=500` | Tags sorted by name, at most `limit` (1 to 1000, default 500). `hasMore` says if there are more. |
| `POST /contacts/:id/tags` | Add a tag by `tagId` or by `name` (created if new) |
| `DELETE /contacts/:id/tags/:tagId` | Remove a tag from a contact |
| `POST /tags/bulk-assign` | Apply one tag to up to 1,000 contacts |

### `GET /contacts`

| Parameter | Meaning |
| --- | --- |
| `q` | Search first name, last name, email and phone. Case-insensitive substring. Several words must all match, so `q=ada lovelace` finds the full name. At most 5 words (more is a 400). |
| `tag` | Only contacts with this tag (a tag **id**) |
| `company` | Exact company name |
| `createdFrom`, `createdTo` | Inclusive date range. A bare date (`2025-06-30`) as `createdTo` covers that whole day. |
| `sort`, `order` | `sort=name` (last name, first name) or `createdAt`; `order=asc` or `desc`. Defaults: `createdAt` descending, `name` ascending. |
| `limit` | 1 to 100, default 20 |
| `cursor` | Opaque cursor from `nextCursor` or `prevCursor` |
| `page` | Jump to a page number. Only allowed while there are 10,000 or fewer matches. Not combinable with `cursor`. |

Response:

```json
{
  "items": [ { "id": "…", "firstName": "Ada", "lastName": "Lovelace", "email": "ada@x.com",
               "phone": null, "company": "Analytical", "version": 3,
               "createdAt": "…", "updatedAt": "…", "tags": [ { "id": "…", "name": "VIP" } ] } ],
  "nextCursor": "…", "prevCursor": null,
  "total": 338, "totalPages": 17, "capped": false, "page": 1
}
```

Past 10,000 matches: `"total": "10000+"`, `"capped": true`, `"totalPages": null`, `"page": null`. See [Pagination](#pagination-and-the-capped-count).

### `PATCH /contacts/:id`

```json
{ "version": 3, "firstName": "Augusta", "email": "AUGUSTA@Example.com", "company": "" }
```

- Only `firstName`, `lastName`, `email`, `phone`, `company` and `version` are accepted. Anything else is rejected.
- First and last name cannot be empty. Email and phone formats are validated. Emails are trimmed and lowercased. Empty strings become `null`.
- Returns the updated contact with the new `version`.
- If nothing actually changed, it returns the current contact with no version bump and no activity.

### Tags

- `POST /contacts/:id/tags` takes exactly one of `{ "tagId": "…" }` or `{ "name": "VIP" }`. Names are unique ignoring case, so `vip` reuses `VIP`. Adding a tag the contact already has does nothing and is not an error. It returns the updated contact.
- `DELETE /contacts/:id/tags/:tagId` returns the updated contact, or 404 if the contact does not have that tag.
- `POST /tags/bulk-assign` takes `{ "contactIds": [ … ], "tagId": "…" }` or `{ …, "name": "…" }` and returns `{ "added": 3, "alreadyTagged": 1, "notFound": 0 }`.

### Errors

Every error uses one shape:

```json
{ "error": { "code": "VERSION_CONFLICT", "message": "…", "details": null } }
```

| Status | Codes | When |
| --- | --- | --- |
| 400 | `BAD_REQUEST`, `PAGE_NOT_ALLOWED` | Bad JSON, malformed id, bad query parameter, bad cursor (including an impossible date inside it), a NUL character in a search or filter, `page` used past the 10,000 cap |
| 404 | `NOT_FOUND` | Unknown contact, tag or route; removing a tag the contact does not have |
| 409 | `VERSION_CONFLICT`, `EMAIL_TAKEN` | Stale edit (the body carries `details.latest`, the current contact); email already used |
| 422 | `VALIDATION_ERROR` | Body field validation (including a NUL character in any text field). `details` lists `{ path, message }` per field. |
| 429 | `RATE_LIMITED` | Too many requests from one client (`Retry-After` says when to retry) |
| 500 | `INTERNAL_ERROR` | Unexpected. The real error is logged, nothing internal is returned except `details.requestId`, which matches the server log line. |
| 503 | `TEMPORARILY_UNAVAILABLE` | The database was busy: a deadlock or no free connection within 5 s. Safe to retry (`Retry-After: 1`). `details.requestId` as for 500. |
| 503 | `QUERY_TIMEOUT` | A query ran past `STATEMENT_TIMEOUT_MS` and was cancelled. The cause is almost always an expensive search, so `Retry-After` is 10 and the message asks to narrow it. |

### Activity events

| Type | `details` |
| --- | --- |
| `CONTACT_UPDATED` | `{ "changes": { "firstName": { "old": "Ada", "new": "Augusta" } } }`, only fields that actually changed |
| `TAG_ADDED`, `TAG_REMOVED` | `{ "tagId": "…", "tagName": "VIP" }` |

The tag name is stored in the event, so history still reads correctly after a tag is renamed.

Every activity item also has `actor`: the `X-Actor` name of the request that caused it (`Anonymous` if none was sent), or `null` for events written before the column existed. For a bulk assign, each created event carries the same actor.

---

## Key decisions

- **Optimistic locking with a `version` column** instead of pessimistic locks or last-write-wins. Two people editing the same contact is the normal case in a CRM, and silently overwriting someone's work is the worst outcome. A stale save gets a 409 that carries the latest contact, so a UI can show what changed. See [Concurrency](#concurrency-approach).
- **Tag changes never bump `version`.** The version guards only the editable contact fields. Otherwise adding a tag in one tab would cause a false conflict for someone editing the name in another. Tag changes update `updated_at` only.
- **Keyset pagination plus a capped count** instead of offset pagination. See [below](#pagination-and-the-capped-count).
- **Postgres trigram indexes for search** (`pg_trgm` GIN indexes on name, email and phone), which makes `ILIKE '%text%'` index-assisted with no extra infrastructure. Moving to a search engine is in the [scale notes](#scale-notes).
- **Kysely, not an ORM.** The interesting queries here (row-value keyset comparisons, capped counts, `ON CONFLICT … RETURNING`) are easier to get right in near-SQL than through an ORM.
- **Activity is written in the same transaction as the change**, so history can never disagree with the data. `CONTACT_UPDATED` is only logged when a field really changed.
- **Email uniqueness is enforced by the database** (unique index on `lower(email)` where email is not null) and surfaced as a 409. There is no check-then-insert race, and any number of contacts may have no email.
- **One error shape everywhere**, with 400 for malformed requests and 422 for field validation, as the spec asks.
- **Tests run against a real Postgres.** The risky behaviour (locking, uniqueness, transactions, pagination) lives in the database, so mocking it would test nothing.

Choices the spec left open, each the simplest option that can be defended:

- `tag` filters by tag **id** (a UI picks from `GET /tags`), not by name.
- Phone numbers accept digits with `+ ( ) - .` and spaces, with at least 7 digits. No country-specific rules.
- `page` beyond the last page returns an empty list, not an error.
- Duplicate ids in a bulk request count once.
- A bulk request where no contact exists reports `notFound` and does not create the tag.
- `PATCH` with unchanged values is a 200 and changes nothing.
- A stale version is a 409 even if the submitted values happen to match the current ones.

---

## Data model

```mermaid
erDiagram
  contacts ||--o{ contact_tags : has
  tags ||--o{ contact_tags : "applied as"
  contacts ||--o{ contact_activities : logs
  contacts {
    uuid id PK
    text first_name
    text last_name
    text email "nullable"
    text phone "nullable"
    text company "nullable"
    int version "default 1"
    timestamptz created_at
    timestamptz updated_at
  }
  tags {
    uuid id PK
    text name
  }
  contact_tags {
    uuid contact_id PK,FK
    uuid tag_id PK,FK
  }
  contact_activities {
    uuid id PK
    uuid contact_id FK
    text type "CONTACT_UPDATED, TAG_ADDED, TAG_REMOVED"
    timestamptz created_at
    text actor "demo label, nullable"
    jsonb details
  }
```

**Constraints and indexes** (in `backend/src/db/migrations/001_init.ts`; `002_activity_actor.ts` adds the nullable `actor` column)

| Table | Constraint or index | Why |
| --- | --- | --- |
| `contacts` | Unique on `lower(email)` where email is not null | Case-insensitive unique email, and many contacts may have none |
| `contacts` | GIN trigram on `first_name`, `last_name`, `email`, `phone` | Substring search |
| `contacts` | `(created_at, id)` and `(last_name, first_name, id)` | Sorting and keyset pagination |
| `contacts` | `company` | Company filter |
| `contacts` | Checks: names not blank, `version >= 1` | Backstop for API validation |
| `tags` | Unique on `lower(name)` | Case-insensitive unique tag names |
| `contact_tags` | Primary key `(contact_id, tag_id)`, both foreign keys `ON DELETE CASCADE` | Blocks duplicate tagging |
| `contact_tags` | Index `(tag_id, contact_id)` | Filter contacts by tag |
| `contact_activities` | `type` check, index `(contact_id, created_at DESC)` | Recent activity per contact |

---

## Concurrency approach

**Editing a contact (optimistic locking).** Every contact response includes `version`, and an update must send the version it started from. Inside one transaction the server:

1. locks the contact row (`SELECT … FOR UPDATE`) so concurrent edits queue up;
2. compares versions: a mismatch is a **409 `VERSION_CONFLICT`** whose `details.latest` is the current contact;
3. works out which fields actually changed (no change, no write);
4. runs `UPDATE … WHERE id = $1 AND version = $2`, setting `version = version + 1` and `updated_at = now()`;
5. inserts the `CONTACT_UPDATED` activity in the same transaction.

The version check appears twice (explicit, and in the `UPDATE`'s `WHERE`), and the row is locked as well. Each layer alone would be enough for correctness; together a future refactor cannot easily break it. If two requests arrive with the same version, exactly one wins and the other gets a 409 (covered by a test that fires both at once).

**Emails.** Normalised (trimmed, lowercased) before saving. A unique-index violation inside the transaction is translated into **409 `EMAIL_TAKEN`** and the whole update rolls back, so no half-applied change and no activity is left behind.

**Tags.** Adding uses `INSERT … ON CONFLICT DO NOTHING RETURNING`, so adding the same tag twice, even simultaneously, produces one link and one activity. Creating a tag by name uses the unique index on `lower(name)` the same way, so two requests creating `VIP` at once share one row. None of this touches `version`.

**Lock order.** Every tag write, single add, single remove and bulk assign, takes the contact's row lock (`FOR NO KEY UPDATE`) **before** touching `contact_tags`. Bulk assign locks many contacts in id order. This matters: an earlier version let single add and remove insert the link first and lock the contact afterwards, which deadlocks against bulk assign (Postgres `40P01`, a 500 and a rolled-back 1,000-contact batch). Racing them showed it; the fix is covered by a test that races both against each other 50 times per case. If the database still reports a deadlock, the API answers a retryable 503, never a bare 500.

**Bulk assign.** One transaction: lock the existing contacts in id order, insert links with `ON CONFLICT DO NOTHING RETURNING` (which yields exactly the newly tagged contacts), touch their `updated_at`, then write all `TAG_ADDED` events with **one multi-row insert**. Statement count does not grow with the number of contacts (tested at 5 and 500). Repeating a request changes nothing.

---

## Pagination and the capped count

`GET /contacts` uses **keyset (cursor) pagination** on `(sort_key, id)` for Next and Previous. The next page is "rows after this one", expressed as a row comparison such as `(last_name, first_name, id) > (…)`, which the `(last_name, first_name, id)` index answers directly. Cost depends on the page size, not on how deep you are. `id` is part of the key, so ties (same name, same timestamp) can never skip or repeat a row. Cursors are opaque, validated and tied to the sort and order they were issued for. Timestamps in cursors keep full microsecond precision.

**The count is capped.** The total is `SELECT count(*) FROM (… matching rows … LIMIT 10001)`:

- **10,000 or fewer matches:** exact `total` and `totalPages`, so a UI can show "page 3 of 42", and `page=N` lets a user jump straight to a page (an `OFFSET` over a result set this small is cheap).
- **More than 10,000:** `total: "10000+"`, `capped: true`. Only Next and Previous work, and offset is never used (`page` returns 400 `PAGE_NOT_ALLOWED`).

**Why not exact counts and plain `OFFSET` pages?** An exact `count(*)` must visit every matching row, so its cost grows with the table, on every request. `OFFSET n` must read and throw away the first n rows, so page 40,000 of a million contacts is slow, and it drifts when rows are inserted while someone pages. Capping the count bounds the work at about 10,001 rows however large the table is, and keyset paging keeps deep pages as cheap as the first. The trade-off is that for very large result sets the UI shows "10000+" and loses jump-to-page, which at that size nobody uses anyway.

Observed on the default 20,000-row seed, on a laptop: list, search, filter and cursor queries answer in roughly 3 to 20 ms, and a keyset page deep into the name ordering executes in about 0.1 ms using the `(last_name, first_name, id)` index.

### Scale test at 1,000,000 contacts

*Not measured yet.* To produce the numbers locally:

```bash
cd backend
npm run seed -- --count 1000000 --reset   # wipes and reseeds the DATABASE_URL database
```

then time a search (`q=`), a filter, and a deep cursor page against that database. Use a throwaway database (for example point `DATABASE_URL` at a new `crm_scale` database) so the 20,000-row demo data is kept. Results go here.

---

## Tests

```bash
cd backend && npm test      # needs Postgres running (docker compose up -d)
```

319 tests across 20 files, in the order of risk the spec lists:

| Area | What is checked |
| --- | --- |
| Optimistic locking | A stale update gets 409 and stored data and history are untouched; two simultaneous edits, exactly one wins |
| Email uniqueness | Duplicates rejected including case and whitespace variants; nothing partially saved |
| Bulk assign | Idempotent; correct activity per newly tagged contact; unknown ids counted; rolls back completely when a step fails (a database trigger forces one); constant statement count; no deadlocks between overlapping bulk requests |
| Pagination | No gaps or duplicates walking Next and Previous, for both sorts and both orders, with heavy ties and microsecond timestamps; the cap at exactly 10,000 and at 10,050 |
| Search and filters | Fields, case-insensitivity, multi-word queries (and the 5-word cap), literal `%` and `_`, tag, company, date ranges, combinations |
| Validation | Status and shape of 400, 404, 409 and 422 responses; unknown fields; tampered cursors: bad shape, forged keys, NUL characters and impossible dates (Feb 30, month 13, hour 24, leap years) are all 400s, never 500s |
| Bad input | A NUL character in every text input (PATCH fields, search, company filter, tag names single and bulk, cursor keys) is a client error and writes nothing; the database-side backstop turns any value Postgres rejects into a 400 |
| Tags | Add and remove leave `version` alone, so an edit started earlier still saves; the tag list is bounded and says when it is cut |
| Tag races | Single add, add by new name and remove are each raced against bulk assign on the same contact and tag, 50 rounds each: no 500s, exactly one link and one activity |
| CORS | A preflight for every method and path the frontend sends lists that method and allows `X-Actor`; origins with spaces; unlisted origins get nothing; production refuses to start without `CORS_ORIGIN` |
| Resilience | An idle connection killed by the server does not crash the process; a full pool fails fast (`/health` answers 503); a runaway statement is cancelled; the startup lock times out; rate limits, including per client behind a proxy |
| Rate limit | A client writing a different `X-Forwarded-For` on every request still hits the limit; real clients behind the proxy keep separate budgets; with no proxy the header is ignored; `/health?x=1` is exempt |
| Timeouts | A statement cut off by the database, and one the client gave up on, are both a documented 503 `QUERY_TIMEOUT` with `Retry-After: 10` and a request id |
| Ids and errors | An invalid id is a 400 on every endpoint and field; 500 and 503 bodies carry a request id and nothing internal |
| Acting as | `X-Actor` is stored on an update, a tag add, a tag remove and every row of a bulk assign; trimmed; missing, blank or over 50 characters becomes `Anonymous` without rejecting the request; the 409 response is unchanged; CORS preflight allows the header |
| API docs | The OpenAPI document lists exactly the endpoints the API has; real responses (success and each error status) match the documented schemas and status codes key for key; the docs did not change error shapes |
| Startup | Seeds only an empty table; a restart adds nothing and does not overwrite an edited contact; two instances starting together seed exactly once; the seed and SSL switches parse strictly |
| Schema and seed | Constraints, indexes and cascades; seed is repeatable, varied and never overwrites existing data |

While building, each group of tests was also checked by deliberately breaking the code under test (for example removing the version check, or the `ON CONFLICT`) and confirming tests fail. A few deliberate breaks survived only because the code has redundant safeguards (for example the version is checked twice), so removing one layer changes nothing observable.

---

## Try the conflict scenario

This shows two people editing the same contact at once (User A and User B in the brief). It needs the frontend, which sends `X-Actor` for you; with only the API, use the `curl` calls below.

1. Open the app in two browser tabs and open the same contact in both.
2. In the first tab pick **Bob** as the acting user, in the second pick **Alice**.
3. In Bob's tab change a field (say the company) and save. It succeeds.
4. In Alice's tab change a field and save. The API answers **409 `VERSION_CONFLICT`** with the latest contact, and the dialog shows what Bob changed next to Alice's edits.
5. Open the contact's activity: Bob's change is recorded with `actor: "Bob"`.

With `curl` (replace `<id>`; `version` is the contact's current version):

```bash
curl -X PATCH localhost:3000/contacts/<id> -H 'Content-Type: application/json' -H 'X-Actor: Bob' \
  -d '{"version":1,"company":"Bob Co"}'     # 200, version becomes 2
curl -X PATCH localhost:3000/contacts/<id> -H 'Content-Type: application/json' -H 'X-Actor: Alice' \
  -d '{"version":1,"company":"Alice Co"}'   # 409 VERSION_CONFLICT, details.latest has Bob's change
```

---

## Known issues

- **No authentication or authorization.** The brief does not ask for it, so every endpoint is public and the app opens straight onto the contact list. To see the conflict flow, use two browser tabs (see [Try the conflict scenario](#try-the-conflict-scenario)).
- **The "acting as" name is a demo label.** It is sent in the `X-Actor` header, can be faked by anyone, and is never used for permissions. In production the actor would come from the logged-in session.
- **No endpoints to rename or delete tags, or to delete contacts.** Not in the brief. (Rows would cascade correctly if contacts were deleted.)
- **Search needs 3 or more characters to benefit from the trigram indexes.** Shorter terms still work but scan more rows, so a search is limited to 5 words and every query is cancelled after `STATEMENT_TIMEOUT_MS` (503). Measured at 20,000 rows, 50 one-letter words took 37 ms; at 1,000,000 rows that would be roughly 2 s per query, which is not yet measured. At 20,000 rows the planner often prefers a sequential scan anyway, which is fastest at that size.
- **Phone search is textual.** Phones are stored as typed, so searching `5550100` will not match `+1-555-0100`.
- **Name sorting follows the database collation** (`en_US.utf8` in the Docker image), not a locale chosen per user.
- **Page numbers drift if data changes while paging**, as with any pagination. Cursors are stable; `page` jumps are a convenience under the cap.
- **Activity timestamps are the transaction start time** (`now()`), so two overlapping transactions could record events slightly out of commit order. Negligible at this scale.
- **The count query runs on every list request** (bounded by the cap, but not free). Caching it is in the scale notes.
- **`/docs` is public in production.** It shows the whole API surface, which is fine for a demo; set `ENABLE_DOCS=false` to hide it.
- **The forwarded address is believed from whoever connects.** With `TRUST_PROXY_HOPS` above 0 the API trusts `X-Forwarded-For` as if a proxy wrote it, so the API must only be reachable through that proxy (as on Railway, where the public URL goes through its edge). Someone who could connect to the service directly could write their own address and sidestep the rate limit.
- **Railway's proxy chain is unverified.** `TRUST_PROXY_HOPS=1` is the expected value; the deploy section says how to check it.
- **The rate limiter is basic.** It is in memory (so per instance, and reset on restart), counts by client address, and does not count requests for unknown routes. It slows down scripts; it is not a substitute for authentication. A shared store (Redis) would be needed with several instances.
- **Tags are created by naming them, by anyone.** The list is capped (`limit`, default 500, with `hasMore`) and writes are rate limited, but a tag picker over thousands of tags would need search or pagination on top of this.
- **Database certificate is not verified by default.** Set `DATABASE_CA_CERT` to verify it. Not testable against Railway's real database from here.
- **`X-Actor` values containing a comma are treated as invalid** (shown as `Anonymous`), because that is what a header sent twice looks like.
- **The 1,000,000-row timings are not recorded yet** (see above).
- **Email trigram index at scale is unverified.** On a 20,000-row seed, when sequential scans are disabled to force an index plan, the planner picked the partial unique index on `lower(email)` instead of the email trigram index. The trigram index is used when that index is out of the way, so this looks like a planner quirk from forcing, but it should be re-checked on the million-row data.

---

## Scale notes

What would change to serve millions of contacts per account and many users:

- **Millions of contacts per account:** add `account_id` to every table and index, and partition by account. Keep keyset pagination and the capped count.
- **Millions of updates per day:** keep updates as short, single-row transactions. Write activity through a transactional outbox to a queue, and partition the activity table by month.
- **Frequent searches and filters:** move search to OpenSearch, fed by change events, and keep the trigram indexes until then. Cache tag lists and counts.
- **Many simultaneous users:** run stateless API instances behind a load balancer. Use PgBouncer for connection pooling and read replicas for list and search, and keep optimistic locking for writes.
- **Security:** production would add login, account-level data isolation through `account_id`, and role-based permissions.

---

## AI usage

- **Tool:** Claude (Claude Code).
- **What it was used for:** design discussion, writing the spec in `docs/backend-spec.md`, scaffolding, and implementing the backend task by task, with tests. Each task was built, run against the test suite, and committed only after Manish Singh approved it.
- **A suggestion that was changed:** Claude proposed cursor-only paging with no total count. Manish changed it to a capped count with page numbers, because the UI needs "page 3 of 42". That is why the list endpoint returns an exact `total` up to 10,000 and supports `page` under the cap.
