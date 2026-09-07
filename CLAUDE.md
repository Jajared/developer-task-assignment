# task-assignment-app

Bun workspace monorepo. Two workspaces, declared in the root `package.json`:

- `backend/` — Express 5 API on the Bun runtime, Prisma 7 over Postgres, port 4000
- `frontend/` — Next.js 16 App Router + Tailwind 4, port 3000

Postgres runs in Docker (`docker-compose.yml`, that one service only). Both
apps run on the host. There is no shared package — see **Type drift** below.

## Commands

Root scripts fan out to both workspaces with `bun --filter '*'`:

```sh
bun install            # postinstall in backend regenerates the Prisma client
bun run db:up          # start Postgres (docker compose); db:down, db:logs
bun dev                # both apps; dev:backend / dev:frontend for one
bun run typecheck      # tsc --noEmit in both
bun test               # backend suite only — needs a running database
bun run lint           # frontend only (eslint)
bun run build          # prisma generate + bun build; next build
```

Prisma scripts live in the backend workspace, so run them as
`bun --filter backend db:migrate`. Note the split: **`db:up`/`db:down` are root
(Docker), `db:migrate`/`db:seed`/`db:studio` are backend (Prisma).**

Use Bun, not npm/yarn/pnpm: `bun install`, `bun run <script>`, `bun test`,
`bunx`. Bun loads `.env` automatically — don't add `dotenv`.

## Type drift is the main hazard

The Prisma schema is the source of truth for types. The backend derives them
from the generated client; the frontend re-declares the same contract by hand
in `frontend/lib/types.ts`. **Nothing enforces that the two agree.**

Changing `backend/db/schema.prisma` means updating `frontend/lib/types.ts` in
the same change. Neither `typecheck` nor `lint` will catch it if you don't.

## Environment

Every `.env.example` is committed; the real `.env` files are gitignored.

- `.env` (repo root) — `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`,
  `POSTGRES_PORT`. **Only `docker-compose.yml` reads this**, to keep the
  database credentials out of the committed compose file. Compose uses `${VAR:?}`,
  so `db:up` fails loudly if it's missing instead of booting with a default
  password. Copy `.env.example` to `.env` before the first `db:up`, and keep the
  values in step with `DATABASE_URL` in `backend/.env` — nothing enforces that.

- `backend/.env` — `DATABASE_URL` (required, throws on boot if missing), `PORT`,
  `NODE_ENV`, `CORS_ORIGINS`, and optionally `GEMINI_API_KEY` (Google AI
  Studio) for LLM inference of a task's required skills — without it, tasks
  created with no skills keep none. The default `DATABASE_URL` already matches
  the compose service.
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL`, inlined at build time.

## State of the repo

- `backend/db/migrations/` holds the initial migration (Skill, Developer, Task
  and the two join tables), `add_task_due_date`, `add_task_subtasks` (nullable
  self-referencing `Task.parentId`, cascade on delete, indexed) and
  `remove_task_due_date_and_priority`, which drops `dueDate`, `priority` and
  the `TaskPriority` enum again — a task is title, description, status,
  assignee, required skills and parent, matching the brief. A fresh checkout needs
  `cp .env.example .env && bun run db:up`, then `bun --filter backend db:migrate`.
- The test suite has never run against Prisma. It needs a live database.

See `backend/CLAUDE.md` and `frontend/CLAUDE.md` for per-app conventions.
