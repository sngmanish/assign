# CRM Contact Workspace — Backend Spec for Claude Code

This is the backend spec for an SDE2/SDE3 take-home. Build exactly what is described here. If something isn't covered, pick the simplest option that can be defended and write it down in the README.

## Implementation order (commit after every task)

Work through these tasks in order. After each one, make sure the code builds and the tests pass. Then make one git commit with a clear message, such as `feat: keyset pagination for contacts`. Don't start the next task until that commit exists, and stop and report if a task can't be completed.

1. **Repo layout:** create the `backend/` and `frontend/` folders, the root README stub, `.gitignore`, `docker-compose.yml` with Postgres, and `.env.example`.
2. **Tech stack setup:** in `backend/`, set up the TypeScript config, Fastify, Kysely with the Postgres driver, Zod, Vitest, lint/format, and npm scripts (dev, build, test, migrate, seed).
3. **Minimal running backend:** add a health endpoint, a database connection and a working migration runner. One smoke test checks that the API starts and reaches Postgres.
4. **Schema migrations:** create all four tables, their constraints and indexes, and enable `pg_trgm`.
5. **Seed script:** generate about 20,000 contacts with varied companies, tags and dates, some of them with no email.
6. **Read endpoints:** `GET /contacts/:id` and a basic `GET /contacts` list, plus the shared error shape and the 404 and 400 handling.
7. **List features:** search, the filters, sorting, keyset pagination and the capped count, with pagination and filter tests.
8. **Contact update:** `PATCH` with Zod validation, optimistic locking (409), email uniqueness (409) and CONTACT\_UPDATED activity, with tests.
9. **Tags:** list tags, add and remove a tag on a contact, with activity events and no version bump, plus tests.
10. **Bulk assign:** one transaction, idempotent, with per-contact activity and result counts, plus tests.
11. **Activity endpoint:** recent activity for a contact, newest first.
12. **README:** how to run it, the stack, key decisions, the data model, the concurrency approach, known issues, the scale notes and AI usage.

**Task 13, prepare for Railway (after the README). Manish does the deployment himself, by hand, in the Railway web dashboard.** Do not use the Railway CLI or any command-line deploy, and do not create Railway projects or services. Claude Code's job is only to get the code ready and write the instructions:

- Make the backend read `DATABASE_URL`, `PORT` and `CORS_ORIGIN` from environment variables, and connect with SSL when deployed.
- On start, run migrations and then the empty-table seed of 20,000 contacts, so no manual commands are needed after deploying.
- Add a "Deploying to Railway (manual, via dashboard)" section to the README, with Manish's steps: create a project, add a Postgres service, connect the GitHub repo as the backend service, set the three environment variables (`DATABASE_URL` from Railway's Postgres reference, `CORS_ORIGIN` as the Vercel domain), deploy, then check the health endpoint and a list query on the live URL.
- Commit. Manish adds the live API URL to the README after he deploys.

The frontend is a separate spec and comes after the backend tasks.

## Repo layout

- Monorepo with separate `backend/` and `frontend/` folders and one root `README.md`.
- Root `docker-compose.yml` runs Postgres.
- `backend/` holds the API, migrations, the seed script and the tests.

## Tech stack

- Node.js + TypeScript
- Fastify for HTTP
- Postgres (Docker Compose), with the `pg_trgm` extension enabled
- Kysely as a type-safe query builder, with no heavy ORM; versioned migrations
- Zod for request validation
- Vitest for tests, run against a real Postgres test database

Hosting: the backend and Postgres run on Railway, and the frontend runs on Vercel. The backend reads `DATABASE_URL` from an environment variable and allows CORS requests from the Vercel domain.

## Data model

### contacts

- `id` uuid primary key
- `first_name`, `last_name` text, required
- `email` text, nullable
- `phone`, `company` text, nullable
- `version` integer, not null, default 1
- `created_at`, `updated_at` timestamptz, not null

Indexes:

- Unique on `lower(email)` WHERE email IS NOT NULL
- GIN trigram indexes on first/last name, email and phone, for search
- `(created_at, id)` and `(last_name, first_name, id)` for sorting and keyset pagination
- `company` for filtering

### tags

- `id` uuid primary key, `name` text
- Unique on `lower(name)`

### contact\_tags

- `contact_id` and `tag_id`, both foreign keys with ON DELETE CASCADE
- Composite primary key `(contact_id, tag_id)`, which blocks duplicates
- Extra index on `(tag_id, contact_id)` for filtering by tag

### contact\_activities

- `id`, `contact_id` (FK), `type`, `created_at`, `details` jsonb
- `type` is one of CONTACT\_UPDATED, TAG\_ADDED or TAG\_REMOVED
- `details` holds the changed fields with old and new values, or the tag id and name. The tag name is stored so history still reads correctly after a rename.
- Index on `(contact_id, created_at DESC)`

## Core rules

### Concurrency (optimistic locking)

- Every contact response includes `version`.
- Updates must send the version they started from.
- The update runs `UPDATE ... WHERE id = $1 AND version = $2`, which also sets `version = version + 1` and `updated_at = now()`.
- If no row is updated and the contact exists, return **409 Conflict** with the latest contact so the UI can show what changed.
- Tag changes update `updated_at` only and never bump `version`, so a tag change can't cause a false 409 for someone editing fields.

### Email uniqueness

- Trim and lowercase emails before saving.
- If the unique index is violated, return **409** with code `EMAIL_TAKEN`. Never return a 500 for this.

### Activity log

- Write the activity in the **same transaction** as the change.
- Log CONTACT\_UPDATED only if a field actually changed.

### Tags

- Users can create a tag on the fly by name. Names are unique and case-insensitive.
- Adding a tag the contact already has is a quiet no-op: no error and no activity event.
- Removing a tag the contact doesn't have returns 404.

### Bulk tag assignment

- Applies one tag to many contacts.
- The request is a list of contact IDs (capped at 1,000) plus a tag.
- Runs in a single transaction.
- Contacts that already have the tag are skipped.
- Every newly tagged contact gets a TAG\_ADDED event.
- The response gives `{ added, alreadyTagged, notFound }` counts.

## API

- `GET /contacts`: list endpoint
  - Search `q` across name, email and phone
  - Filters: `tag`, `company`, `createdFrom` and `createdTo`
  - Sort: `sort=name|createdAt` with `order=asc|desc`
  - Pagination: `limit` (max 100), plus either an opaque `cursor` for Next/Previous or a `page` number (only allowed under the 10,000 count cap)
- `GET /contacts/:id`: one contact with its tags and version
- `PATCH /contacts/:id`: update fields plus `version`
- `GET /contacts/:id/activities?limit=20`: recent activity
- `GET /tags`: list all tags
- `POST /contacts/:id/tags`: add a tag, by `tagId` or `name`
- `DELETE /contacts/:id/tags/:tagId`: remove a tag
- `POST /tags/bulk-assign`: body `{ contactIds, tagId | name }`

### Pagination

- The same paging works for every account: keyset (cursor) pagination on `(sort_key, id)` for Next and Previous.
- Capped count: count matching rows only up to 10,001, using `SELECT count(*) FROM (... LIMIT 10001)`.
- At or under 10,000 matches, return the exact `total` and `totalPages` so the UI can show "page 3 of 42". Jumping straight to a page is allowed in this range, using `page` (OFFSET). That's cheap because the result set is capped.
- Over 10,000 matches, return `total: "10000+"` and `capped: true`. Only Next and Previous work there, and offset is never used.
- The response has `items`, `nextCursor`, `prevCursor`, `total`, `capped` and `page`.
- README: explain the capped count and why exact counts or deep OFFSET don't scale to millions of contacts.

### Errors

- Use one consistent error shape: `{ error: { code, message, details } }`.
- Status codes:
  - 400: malformed requests (bad JSON, malformed id, bad query params). 422: field validation errors, with field-level details from Zod
  - 404: not found
  - 409: conflict or email already taken
  - 500: unexpected errors, with nothing internal leaked

## Seed data

- One seed script takes a count option. By default it generates 20,000 contacts, used for the demo and the hosted Railway database. With a larger count (e.g. 1,000,000) it generates contacts randomly for local scale testing. No data file is committed. Big runs insert in batches of 5,000 to 10,000 rows or use COPY, and a fixed random seed keeps the data repeatable. The million-row run is manual and local only, and its search and pagination timings go in the README.
- It assigns varied companies, tags and spread-out created dates.
- Some contacts have no email.
- That is enough to show search, filters, pagination, sorting and tags.

## Tests (highest risk first)

- A stale-version update returns 409 and the stored data is left unchanged.
- A duplicate email on update is rejected, including case variants.
- Bulk assign is idempotent and logs the correct activities.
- Keyset pagination has no gaps or duplicates across pages, for both sort orders.
- Search and filter combinations return the right results.
- Validation errors return the right status and shape.
- Adding or removing a tag leaves `version` unchanged, so an edit started before it still saves.
- The startup seed runs only when the contacts table is empty, and a restart doesn't add or overwrite data.

## README items

The README needs to cover:

- How to run the app
- The tech stack
- Key decisions
- The data model
- The concurrency approach
- Known issues
- Scale notes
- An AI usage note

The scale notes are in the "Scale notes for the README" section below.

## Additional rules (gaps found against the brief)

- Contacts, tags and activity live in Postgres, so data survives restarts. On startup the backend runs migrations, then seeds the default 20,000 contacts only if the contacts table is empty. Restarts and redeploys never overwrite existing data. The large seed is a separate manual command.
- `PATCH` accepts only known fields. Unknown fields are rejected. First and last name can't be empty. Email and phone formats are validated, and empty strings become null.
- An unknown contact or tag id returns 404. A malformed id returns 400.
- Tag add, remove and bulk assign don't touch `version`. The version guards only the editable contact fields.
- `GET /contacts/:id/activities` returns the newest first. Every activity includes `contactId`, `type` and `createdAt`.
- Bulk assign writes its TAG\_ADDED events with a single multi-row insert.

## Authentication and authorization

- The app has no authentication or authorization, because the brief doesn't ask for it. Every endpoint is public.
- The app opens straight onto the contact list.
- To demonstrate the User A / User B conflict, use two browser tabs.
- Under known limitations in the README, say that there is no auth.
- Add this line to the README's scale section: production would add login, account-level data isolation through `account_id`, and role-based permissions.

## Scale notes for the README

- **Millions of contacts per account:** add `account_id` to every table and index, and partition by account. Use keyset pagination and the capped count.
- **Millions of updates per day:** keep updates short, single-row transactions. Write activity through a transactional outbox to a queue, and partition the activity table by month.
- **Frequent searches and filters:** move search to OpenSearch, fed by change events, and keep trigram indexes until then. Cache tag lists and counts.
- **Many simultaneous users:** run stateless API instances behind a load balancer. Use PgBouncer for connection pooling, read replicas for list and search, and keep optimistic locking for writes.

## README: AI usage section

- Name the tool used (Claude), what it was used for (design discussion, spec, scaffolding), and one suggestion that was changed.
- The real example: Claude proposed cursor-only paging with no total count. Manish changed it to a capped count with page numbers, because the UI needs "page 3 of 42".

## Requirements coverage

| Brief requirement | Where it's covered |
| --- | --- |
| Contact fields, including created and updated dates | contacts table |
| Search by name, email or phone | `q` + trigram indexes |
| Filter on at least two attributes | tag, company, created date range |
| Sort by name and created date | `sort` + matching indexes |
| Backend pagination, millions of contacts | Keyset + capped count |
| View and update a contact | `GET` / `PATCH /contacts/:id` |
| View, add and remove tags | contact\_tags + tag endpoints |
| Bulk tag assignment | `POST /tags/bulk-assign` |
| Data survives restarts | Postgres in Docker volume |
| Input validation, error handling | Zod + one error shape |
| Unique email when present | Partial unique index on `lower(email)`, 409 |
| Stale update detection | `version` + 409 with latest |
| Activity: CONTACT\_UPDATED, TAG\_ADDED, TAG\_REMOVED | contact\_activities, same transaction |
| View recent activity | `GET /contacts/:id/activities` |
| Tests for high-risk areas | Tests section |
| Seed data | 20,000 generated contacts |
| README sections, scale, AI usage | README items + sections above |

The frontend items (loading, no results, invalid input, failures, conflicts) are out of scope for this backend spec. The 409 conflict response and the error shape are what the frontend will use for them.
