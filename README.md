# task-assignment-app

A small engineering-backlog tool: tasks are assigned to developers based on
the skills they hold, can be broken into nested subtasks, and can have their
required skills inferred from their title by an LLM.

Bun workspace monorepo with two apps:

| App | Stack | Port |
| --- | --- | --- |
| `backend/` | Express 5 on Bun, Prisma 7, Postgres, Zod, Winston, Google Gemini | 4000 |
| `frontend/` | Next.js 16 App Router, React 19, Tailwind 4, shadcn/ui, TanStack Query | 3000 |

Postgres runs in Docker (`docker-compose.yml`); both apps run on the host.

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

Prerequisites: [Bun](https://bun.sh) 1.3+, Docker.

```sh
bun install                          # also generates the Prisma client
cp .env.example .env                 # Postgres credentials for docker compose
cp backend/.env.example backend/.env # DATABASE_URL etc. — defaults match compose

bun run db:up                        # start Postgres on :5432
bun --filter backend db:migrate      # apply migrations
bun --filter backend db:seed         # skills, developers and sample tasks
bun dev                              # backend on :4000, frontend on :3000
```

Open http://localhost:3000. The API answers at http://localhost:4000 (try
`GET /health`).

To enable skill inference, set `GEMINI_API_KEY` in `backend/.env` (a free
Google AI Studio key works). `GEMINI_MODEL` defaults to `gemini-2.5-flash`.

Without Docker: point `DATABASE_URL` at any Postgres, or run
`bun --filter backend db:dev` for Prisma's local server and paste the URL it
prints into `backend/.env`.

## Scripts

Root scripts (run from the repo root):

| Command | What it does |
| --- | --- |
| `bun run db:up` / `db:down` / `db:logs` | Start / stop / tail the Postgres container |
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
| `.env` | `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`. Read only by `docker-compose.yml`, which refuses to start if any is missing. |
| `backend/.env` | `DATABASE_URL` (required), `PORT`, `NODE_ENV`, `CORS_ORIGINS`, `LOG_LEVEL`, `GEMINI_API_KEY`, `GEMINI_MODEL` |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL` (default `http://localhost:4000`), inlined at build time |

The root `.env` and `DATABASE_URL` must describe the same database; nothing
enforces that.

## API

All responses are JSON. Errors are `{ error, details? }` at the relevant
status: 404 missing row, 422 invalid body or unknown referenced row, 409 a
business rule refused the request.

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/health` | `{ status: "ok", uptime }` |
| `GET` | `/api/tasks` | Flat list, newest first. Subtasks are rows with `parentId` set. |
| `GET` | `/api/tasks/:id` | One task with `assignee` and `requiredSkills` nested |
| `POST` | `/api/tasks` | Create. Body may nest `subtasks` recursively; whole tree in one transaction. 201 with the root row. |
| `PATCH` | `/api/tasks/:id` | Body `{ assigneeId }`; `null` unassigns. 409 `details.missingSkills` if under-skilled. |
| `PATCH` | `/api/tasks/:id/status` | Body `{ status }`. 409 `details.unfinishedSubtasks` if subtasks are open. |
| `GET` | `/api/developers` | Each with their `skills` |
| `GET` | `/api/developers/:id` | |
| `GET` | `/api/skills` | |
| `GET` | `/api/skills/:id` | |

Create body:

```json
{
  "title": "Build the settings page",
  "description": "optional",
  "status": "todo",
  "assigneeId": null,
  "requiredSkillIds": [],
  "subtasks": [{ "title": "Wire the form" }]
}
```

`requiredSkillIds` omitted or empty means "infer from the title" (when a
Gemini key is configured). Limits: subtasks nest at most 4 levels deep, at
most 20 direct subtasks per task, at most 50 tasks per create. Title,
description and required skills are fixed after creation; only assignee and
status change.

## Data model

```
Skill      id, name (unique)
Developer  id, name, skills[]
Task       id, title, description?, status (todo|in_progress|done),
           assigneeId?, requiredSkills[], parentId?
```

Skills and developers are seeded reference data with no write routes. The
assignment and completion rules are enforced in the backend service layer,
not by database constraints.

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
docker-compose.yml          # Postgres only
```

### Types are duplicated on purpose

There is no shared package. The Prisma schema is the source of truth; the
backend derives its types from the generated client, and the frontend declares
the same contract by hand in `frontend/types/`. Nothing checks that they agree,
so a schema change must be mirrored there in the same commit. The same goes
for the subtask caps in `backend/src/lib/constants.ts` and
`frontend/lib/constants.ts`.

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
