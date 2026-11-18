# CLAUDE.md

## Source of truth
- `docs/backend-spec.md` is the source of truth for the backend (`backend/`). Read it fully before doing anything there.
- `docs/frontend-spec.md` is the source of truth for the frontend (`frontend/`). Read it fully before doing anything there. The PDF brief comes first: build nothing the brief doesn't ask for.
- If a spec is unclear or contradicts itself, ask the user before guessing. If something isn't covered, pick the simplest defensible option and record it in the README.
- Items the frontend spec marks **Open** are the user's decisions: ask, don't pick.

## Workflow
- Work through the implementation tasks in the spec's order, one at a time: "Implementation order" in the backend spec, "Task order" in the frontend spec.
- After each task, make sure the code builds and the tests pass, then make one git commit with a clear message (e.g. `feat: keyset pagination for contacts`).
- Don't start the next task until that commit exists. If a task can't be completed, stop and report.
- Unless the user says otherwise, stop after each task and show what was done.

## Frontend structure
`frontend/` is an npm-workspaces monorepo (details in `frontend/README.md`):
- `app` (`@crm/web`): the Vite + React app: routing, store, pages, `vite.config.ts`, env.
- `packages/ui` (`@crm/ui`): all components. `src/components/` holds every component, the design-system ones and our own, each in its own folder (including `Table` and `Modal`); `src/tokens`, `src/styles`, `src/icons` and `src/utilities` sit next to it. The component styles are plain CSS modules (no PostCSS/Sass setup); `scripts/generate-icons.mjs` regenerates `src/icons/react` from the SVGs.
- `packages/docs` (`@crm/docs`): the Storybook for `@crm/ui` (`npm run docs` from `frontend/`).

The spec uses the real paths and names (`frontend/app/src/…`, `@crm/ui`, `Table`, `Modal`). There is no alias layer: inside `@crm/ui` files import each other with relative paths; the app imports components from `@crm/ui` (and stylesheet entries by path, e.g. `@crm/ui/tokens.css`); the stories import by path inside `src`, e.g. `@crm/ui/components/Table`. If the app needs something that `@crm/ui` does not export yet, add it to `packages/ui/src/index.ts` instead of deep-importing it.
- Import components by name from `@crm/ui` (add the export to `packages/ui/src/index.ts` if it is missing). Wrappers that only combine `@crm/ui` components for one screen live in the app, not in `@crm/ui`. Don't delete unused components on your own: the user decides when.
- Frontend tests are Playwright end-to-end tests in `app/e2e` (`npm run test:e2e`, or `test:e2e:headed`), against the real API and a throwaway `crm_e2e` database. Don't add other test tooling (unit/component tests) until the user asks.
- `npm run check` (typecheck, lint, format check, app and Storybook builds) must pass before a commit.
- The app imports components only from `@crm/ui`, never from deep paths. The app's own hooks live in `app/src/hooks/` (e.g. `useDebounce`). Pages, the RTK Query slice, the store and routing live in the app.
- **React 18** (not 19), with `@types/react` 18. Don't upgrade it or use React 19-only APIs.
- Run commands from `frontend/` (`npm install`, `npm run dev`, `npm run build`, `npm run typecheck`).
- The backend API contract is in the README's API section and, live, at `/docs` on the running API. Prefer those over memory.

## Deployment rules
- NEVER deploy to Railway or Vercel, and NEVER use the Railway or Vercel CLIs (no `railway`, `vercel`, or any command-line deploy). Don't create Railway/Vercel projects or services.
- The user deploys by hand through the web dashboards. Claude's only job is to get the code ready and write the README instructions (spec Task 13).
