# Frontend

React 18 + TypeScript on Vite, organised as an npm-workspaces monorepo. The spec is
[`docs/frontend-spec.md`](../docs/frontend-spec.md); the project rules for contributors are in
[`CLAUDE.md`](../CLAUDE.md).

```
frontend/
  app/               @crm/web    the app (Vite, React, routing, store, pages)
    src/hooks/                   the app's hooks (useDebounce)
    e2e/                         Playwright end-to-end tests
  packages/ui/       @crm/ui     components
    src/components/              every component, each in its own folder (Table, Modal, Button ...)
    src/tokens, styles, icons/   design tokens, component styles, vendored SVG icons
    src/utilities/               hooks and helpers the components use
  packages/docs/     @crm/docs   Storybook for @crm/ui
  vercel.json                    Vercel build settings and the SPA rewrite
```

The app depends on the component package by name (`@crm/ui`). The packages ship TypeScript
source and Vite compiles them with the app, so there is no per-package build.

## Run it

```bash
cd frontend
cp app/.env.example app/.env   # VITE_API_URL, the backend's base URL
npm install
npm run dev          # the app, http://localhost:5173
npm run docs         # Storybook, http://localhost:6006
```

The backend's default `CORS_ORIGIN` already allows `http://localhost:5173`.

| Command                           | Does                                                                               |
| --------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run dev`                     | Vite dev server for `app`                                                          |
| `npm run build`                   | Type-check, then build `app` into `app/dist`                                       |
| `npm run preview`                 | Serve the built app                                                                |
| `npm run docs`                    | Storybook dev server                                                               |
| `npm run docs:build`              | Build Storybook into `packages/docs/storybook-static`                              |
| `npm run typecheck`               | Type-check every workspace (and the e2e tests)                                     |
| `npm run lint` / `lint:fix`       | ESLint over everything, stories included                                           |
| `npm run format` / `format:check` | Prettier                                                                           |
| `npm run check`                   | Everything CI would run: typecheck, lint, format check, app build, Storybook build |
| `npm run test:e2e`                | Playwright end-to-end tests, headless                                              |
| `npm run test:e2e:headed`         | The same, in a visible browser, one test at a time                                 |
| `npm run test:e2e:ui`             | Playwright's UI mode: pick tests, step through them, time-travel the DOM           |
| `npm run test:e2e:report`         | Open the HTML report of the last run                                               |

Arguments after `--` go to Playwright, e.g. `npm run test:e2e:headed -- e2e/conflict.spec.ts` or
`npm run test:e2e -- -g "Merge both"`.

## End-to-end tests

The tests in `app/e2e/` drive the real app against the real API and a real database. Nothing is
mocked except two error responses (a 422 and a 500) that the backend won't produce on demand.

**Needs:** the docker-compose Postgres running (`docker compose up -d` from the repo root), the
backend's dependencies installed (`cd backend && npm install`), and Playwright's browser, once:

```bash
cd frontend/app && npx playwright install chromium
```

**What a run does** (`app/playwright.config.ts`):

1. `e2e/start-api.mjs` drops and recreates a separate `crm_e2e` database on the same Postgres
   server as the repo-root `.env`'s `DATABASE_URL` (or the database in `E2E_DATABASE_URL`), then
   starts the API on port **3100**. On start the API migrates and seeds the same 20,000 contacts as
   always (fixed random seed), so every run starts from identical data. The dev database is never
   touched.
2. The app runs on port **5174** with `VITE_API_URL` pointing at that API.
3. Tests run in parallel. Each test that changes data takes its own contact (`nthContact(request, n)`
   in `e2e/helpers.ts`) and makes unique values, so tests never step on each other.

Different ports from `npm run dev` (5173 / 3000), so a running dev setup is left alone. Failures
keep a trace, a screenshot and the page's accessibility snapshot under `app/test-results/`
(`npx playwright show-trace <trace.zip>`).

## Build and deploy

`npm run build` type-checks, then writes `app/dist`. The bundle is split so the first load stays
small: the contact list and React/Redux/Router load up front; the detail page and its edit form are
separate chunks. The edit form carries `google-libphonenumber` (about 150 kB gzipped), so it is only
fetched when someone clicks **Edit**; hovering or focusing Edit starts the download early.

Vercel deploys it on every push to `main` that changes `frontend/` (Root Directory `frontend`, one environment variable, `VITE_API_URL`)
(details in the root README's [Deploy](../README.md#deploy) section). `vercel.json` holds the
install and build commands, the output directory (`app/dist`) and the SPA rewrite.

## How the pieces fit

- There is no alias layer. Inside `@crm/ui`, files import each other with relative paths. The
  app imports from `@crm/ui` itself; the stories also import other files by their path inside
  `src`, e.g. `@crm/ui/components/Button` (the package's `exports` map `./*` to `./src/*`).
- `@crm/ui` declares `"sideEffects": ["**/*.css"]`, so the bundler can leave unused exports out of
  a chunk. That is what lets the lazily loaded edit form take `ContactForm` and the phone input
  with it instead of the main bundle.
- Icons are generated React components in `src/icons/react` (`import CheckIcon from '@crm/ui/icons/react/CheckIcon'`),
  made from the SVG files in `src/icons/svg` by `npm run icons -w @crm/ui`. `@crm/ui/icons` is a
  barrel of all of them. Run the script again after adding or removing an SVG.
- The component styles are plain CSS (CSS modules), so Vite needs no PostCSS or Sass setup.
- `app/src/main.tsx` imports the design tokens (`@crm/ui/tokens.css`) and the app's base styles (`app/src/app/base.css`: box sizing, page colours, link styles) once.

## Code style

One ESLint config (`eslint.config.js`) and one Prettier config (`.prettierrc.json`, the same as the
backend's) cover the whole workspace. ESLint uses the recommended JavaScript, TypeScript, React,
JSX accessibility and the two classic React hooks rules (`rules-of-hooks`, `exhaustive-deps`);
react-hooks v7's React Compiler rules are left off because the app doesn't use the compiler.
A disable comment must say why, and an unneeded one is an error.

## Adding things

- **A component:** a reusable building block goes in a folder in `packages/ui/src/components/`,
  exported from `packages/ui/src/index.ts`; the app imports it from `@crm/ui`. A wrapper that only
  combines `@crm/ui` components for one screen (e.g. `FiltersPanel`, `ActivityTimeline`) lives in the app.
- **A hook:** a file in `app/src/hooks/`.
- **A story:** under `packages/docs/stories/`.
- **An end-to-end test:** a `*.spec.ts` file in `app/e2e/`. Use a contact position no other test
  uses, and `unique()` for any value you write.

## Status

Spec Tasks 1-8 and 10 are built (list, detail, edit with conflict handling, tags and bulk tagging,
acting-as; Vercel prep). Task 9 is started as Playwright end-to-end tests covering the spec's test
list; there are no component unit tests yet.
