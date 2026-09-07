# task-assignment-app

Bun workspace monorepo: `backend/` (Express 5 on Bun, Prisma 7, Postgres, port
4000) and `frontend/` (Next.js 16 App Router, Tailwind 4, port 3000). Postgres
runs in Docker; both apps run on the host. Per-app conventions live in
`backend/CLAUDE.md` and `frontend/CLAUDE.md`.

## Commands

Use Bun only (`bun install`, `bun run <script>`, `bunx`). Bun loads `.env`
itself — never add `dotenv`.

```sh
bun install                        # postinstall regenerates the Prisma client
bun run db:up                      # Postgres via docker compose (db:down, db:logs)
bun --filter backend db:migrate    # Prisma migrate dev; db:seed, db:studio, db:reset
bun dev                            # both apps; dev:backend / dev:frontend for one
bun run typecheck                  # tsc --noEmit in both workspaces
bun run lint                       # eslint, frontend only
bun run test                       # backend only; needs a running, seeded database
bun run build                      # prisma generate + bun build; next build
```

`db:up`/`db:down` are root scripts (Docker). `db:migrate`/`db:seed`/`db:studio`
are backend scripts (Prisma) — run them with `bun --filter backend`. Use
`bun run test`, not bare `bun test` from the root: the latter never loads
`backend/.env`.

## Type drift is the main hazard

`backend/db/schema.prisma` is the source of truth. The backend derives types
from the generated client; the frontend re-declares the API contract by hand in
`frontend/types/`. Nothing enforces agreement — neither `typecheck` nor `lint`
catches drift. **Any schema change must update `frontend/types/` in the same
change.** The backend declares no response types, so verify against a real
response (`curl localhost:4000/api/tasks`).

The subtask caps (`MAX_SUBTASK_DEPTH`, `MAX_SUBTASKS_PER_TASK`,
`MAX_TASKS_PER_CREATE`) are likewise duplicated: `backend/src/lib/constants.ts`
enforces, `frontend/lib/constants.ts` mirrors. Keep them equal.

## Environment

All `.env.example` files are committed; real `.env` files are gitignored.

- **`.env` (root)** — `POSTGRES_USER/PASSWORD/DB/PORT`. Read only by
  `docker-compose.yml`, which uses `${VAR:?}` so `db:up` fails loudly if it is
  missing. Must agree with `DATABASE_URL` below; nothing checks that.
- **`backend/.env`** — `DATABASE_URL` (required), `PORT`, `NODE_ENV`,
  `CORS_ORIGINS`, `LOG_LEVEL`, and optional `GEMINI_API_KEY` / `GEMINI_MODEL`
  for LLM inference of a task's required skills. Without a key, tasks created
  with no skills keep none.
- **`frontend/.env.local`** — `NEXT_PUBLIC_API_URL`, inlined at build time.

Fresh checkout: `cp .env.example .env && cp backend/.env.example backend/.env`,
then `bun install`, `bun run db:up`, `bun --filter backend db:migrate`,
`bun --filter backend db:seed`.

## Domain in one paragraph

Skills and developers are seeded, read-only reference data. A task has a
title, description, status (`todo | in_progress | done`), optional assignee,
required skills and an optional parent (subtasks, nested to a capped depth).
Two rules are enforced in `backend/src/services/tasks/tasks.service.ts`, not
the database: a task may only be assigned to a developer holding every
required skill (409 `missingSkills`), and may only be `done` once all direct
subtasks are (409 `unfinishedSubtasks`). After creation only assignee and
status can change.
