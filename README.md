# task-assignment-app

A small engineering-backlog tool: tasks are assigned to developers based on
the skills they hold, can be broken into nested subtasks, and can have their
required skills inferred from their title by an LLM.

Bun workspace monorepo with two apps:

| App | Stack | Port |
| --- | --- | --- |
| `backend/` | Express 5 on Bun, Prisma 7, Postgres, Zod, Winston, Google Gemini | 4000 |
| `frontend/` | Next.js 16 App Router, React 19, Tailwind 4, shadcn/ui, TanStack Query | 3000 |

Everything runs in Docker via `docker-compose.yml` (Postgres, migrations,
backend, frontend). For development, run only Postgres in Docker and both apps
on the host.

## Features

- **Task list** with filters (all, to do, in progress, done, unassigned),
  rendered as a tree of tasks and subtasks. Table on desktop, cards on mobile.
- **Create tasks with nested subtasks** in one form, written in one transaction.
- **Skill-gated assignment.** A task can only be assigned to a developer who
  holds every skill it requires. The UI disables or hides ineligible
  developers; the API refuses with a 409 naming the missing skills.
- **Completion rule.** A task can only be marked done once all its direct
  subtasks are done. Reopening a done subtask reopens its done ancestors.
- **LLM skill inference.** A task created without required skills has them
  inferred from its title by Gemini, constrained to the skills that exist.
  Optional: without an API key, tasks simply keep no skills.
- **Shareable views.** The active filter and open task live in the URL.

## Getting started

### Run everything in Docker

Prerequisites: Docker with Compose v2.

```sh
cp .env.example .env                 # Postgres credentials (+ optional GEMINI_API_KEY)
bun run docker:up                    # build images, start postgres, backend, frontend
bun run docker:migrate               # REQUIRED: apply migrations and seed the database
```

Open http://localhost:3000.

**Don't skip `docker:migrate`.** The containers do not migrate the database
themselves (that step is meant to move into CI). Until it has run, the
backend is up but every `/api` request fails with a missing-table error. Run
it after the first `docker:up`, after `docker compose down -v`, and after
pulling a schema change. It is idempotent: applied migrations are skipped and
the seed only fills what is missing. Under the hood it runs
`prisma migrate deploy` and `db/seed.ts` inside the backend image against the
compose network.

Compose builds `backend/Dockerfile` and `frontend/Dockerfile`, then starts
Postgres, the backend on :4000 and the frontend on :3000, each gated on the
previous being healthy. Ports 3000, 4000 and 5432 must be free on the host (stop `bun dev`
first). `bun run docker:logs` tails everything; `bun run docker:down` stops it
(`docker compose down -v` also drops the database).

Inside the compose network the frontend's server components call the API at
`http://backend:4000` (`API_URL`, runtime), while the browser calls
`http://localhost:4000` (`NEXT_PUBLIC_API_URL`, baked into the frontend image).
Serving from another host means setting `NEXT_PUBLIC_API_URL` and
`CORS_ORIGINS` in `.env` and rebuilding. The backend runs with
`NODE_ENV=production`, so logs are at level `http` (same one-line colored
format as development).

### Develop on the host

Prerequisites: [Bun](https://bun.sh) 1.3+, Docker.

```sh
bun install                          # also generates the Prisma client
cp .env.example .env                 # Postgres credentials for docker compose
cp backend/.env.example backend/.env # DATABASE_URL etc. — defaults match compose

bun run db:up                        # start Postgres on :5432
bun --filter backend db:migrate      # apply migrations
bun --filter backend db:seed         # skills and developers
bun dev                              # backend on :4000, frontend on :3000
```

Open http://localhost:3000. The API answers at http://localhost:4000 (try
`GET /health`).

To enable skill inference, set `GEMINI_API_KEY` in `backend/.env` (a free
Google AI Studio key works). `GEMINI_MODEL` defaults to `gemini-3.5-flash`.

Without Docker: point `DATABASE_URL` at any Postgres, or run
`bun --filter backend db:dev` for Prisma's local server and paste the URL it
prints into `backend/.env`.

## Scripts

Root scripts (run from the repo root):

| Command | What it does |
| --- | --- |
| `bun run docker:up` / `docker:logs` | Build and run / tail the whole stack in Docker |
| `bun run docker:stop` / `docker:down` | Stop the containers (keep them) / remove containers and network (`-v` also drops the database) |
| `bun run docker:migrate` | Apply migrations and seed inside the Docker stack (required after `docker:up`) |
| `bun run db:up` / `db:down` / `db:logs` | Start / stop / tail only the Postgres container |
| `bun dev` | Run backend and frontend together |
| `bun dev:backend` / `bun dev:frontend` | Run one app |
| `bun run build` | Generate client + bundle backend; `next build` |
| `bun run start` | Run the built apps |
| `bun run test` | Backend test suite (needs a running, seeded database) |
| `bun run typecheck` | `tsc --noEmit` in both apps |
| `bun run lint` | ESLint on the frontend |

Database scripts live in the backend workspace: `bun --filter backend <script>`.

| Script | What it does |
| --- | --- |
| `db:migrate` | Create and apply a migration from schema changes; regenerates the client |
| `db:deploy` | Apply existing migrations (deployed environments) |
| `db:push` | Push the schema without writing a migration |
| `db:generate` | Regenerate the Prisma client |
| `db:seed` | Insert reference data and sample tasks; safe to re-run |
| `db:studio` | Open Prisma Studio |
| `db:reset` | Drop, re-migrate, re-seed |
| `db:dev` | Prisma's built-in local Postgres, as an alternative to Docker |

Use `bun run test`, not bare `bun test`, from the root — the latter skips
`backend/.env`.

## Environment

Every `.env.example` is committed; the real files are gitignored.

| File | Variables |
| --- | --- |
| `.env` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`; optional `GEMINI_API_KEY`, `GEMINI_MODEL`, `BACKEND_PORT`, `FRONTEND_PORT`, `NEXT_PUBLIC_API_URL`, `CORS_ORIGINS`. Read only by `docker-compose.yml`, which refuses to start if a Postgres variable is missing and derives the containers' `DATABASE_URL` from them. |
| `backend/.env` (host dev only) | `DATABASE_URL` (required), `PORT`, `NODE_ENV`, `CORS_ORIGINS`, `LOG_LEVEL`, `GEMINI_API_KEY`, `GEMINI_MODEL` |
| `frontend/.env.local` (host dev only) | `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`), inlined at build time. In Docker, `API_URL` additionally sets the server-side URL at runtime. |

When developing on the host, the root `.env` and `backend/.env`'s
`DATABASE_URL` must describe the same database; nothing enforces that. The
compose stack has no such gap: it builds `DATABASE_URL` from the `POSTGRES_*`
values.

## Project structure

```
backend/
  db/schema.prisma          # source of truth for tables and types
  db/migrations/            # committed SQL
  db/seed.ts
  prisma.config.ts          # schema path, migrations path, DATABASE_URL
  src/app.ts                # Express app factory
  src/lib/                  # env, logging, validation, LLM client, constants
  src/services/{tasks,developers,skills}/   # route / controller / service / validator
frontend/
  app/                      # App Router: page, layout, error boundary
  app/_components/          # task list, detail panel, create form
  app/_hooks/               # React Query mutations, nuqs URL state
  components/ui/            # shadcn/ui
  lib/                      # API client, query definitions, constants
  types/                    # hand-maintained copy of the API contract
backend/Dockerfile          # oven/bun; serves the API (docker:migrate reuses it)
frontend/Dockerfile         # next build → standalone output on node:22-slim
docker-compose.yml          # postgres, backend, frontend
```

## Testing

```sh
bun run test
```

Backend only, 4 suites, 38 tests. Two are pure (LLM schema handling, request
validation caps). Two drive the app over HTTP against the real database and
need `db:up`, `db:migrate` and `db:seed` first. The LLM is always stubbed;
no test needs a Gemini key. The suites clean up every row they create.

There are no frontend tests.

## Further reading

- [`backend/README.md`](backend/README.md) — API details, logging, inference
- [`frontend/README.md`](frontend/README.md) — app structure, state management
- `CLAUDE.md` files — conventions for AI-assisted development
