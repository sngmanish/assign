# CLAUDE.md

## Source of truth
- `docs/backend-spec.md` is the source of truth for this project. Read it fully before doing anything.
- If the spec is unclear or contradicts itself, ask the user before guessing. If something isn't covered, pick the simplest defensible option and record it in the README.

## Workflow
- Work through the implementation tasks in the spec's "Implementation order" section, in order, one at a time.
- After each task, make sure the code builds and the tests pass, then make one git commit with a clear message (e.g. `feat: keyset pagination for contacts`).
- Don't start the next task until that commit exists. If a task can't be completed, stop and report.
- Unless the user says otherwise, stop after each task and show what was done.

## Deployment rules
- NEVER deploy to Railway or Vercel, and NEVER use the Railway or Vercel CLIs (no `railway`, `vercel`, or any command-line deploy). Don't create Railway/Vercel projects or services.
- The user deploys by hand through the web dashboards. Claude's only job is to get the code ready and write the README instructions (spec Task 13).
