# task-assignment-app

A small engineering-backlog tool: tasks are assigned to developers based on
the skills they hold, can be broken into nested subtasks, and can have their
required skills inferred from their title by an LLM.

Bun workspace monorepo with two apps:

| App | Stack | Port |
| --- | --- | --- |
| `backend/` | Express 5 on Bun, Prisma 7, Postgres, Zod, Winston, Google Gemini | 4000 |
| `frontend/` | Next.js 16 App Router, React 19, Tailwind 4, shadcn/ui, TanStack Query | 3000 |

Everything runs in Docker via `docker-compose.yml` (Postgres, a one-shot
migrate+seed job, backend, frontend); `docker compose up --build` is the only
command needed. For development, run only Postgres in Docker and both apps on
the host.

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

## Prerequisites

There are two ways to run the app. Pick one; the Docker path needs the least.

| To… | You need | Notes |
| --- | --- | --- |
| Run the whole app in Docker (recommended for evaluation) | [Docker](https://docs.docker.com/get-docker/) with Compose v2 (Docker Desktop 4.x, or Docker Engine 20.10+ with the `docker compose` plugin) | Nothing else. Bun, Node and npm are not needed on the host; the images bring their own runtimes. |
| Develop on the host | [Bun](https://bun.sh) 1.3+ and Docker (for Postgres only) | Bun is the runtime, package manager and test runner for both workspaces. |
| Enable LLM skill inference (optional) | A Google AI Studio API key in `GEMINI_API_KEY` | Free tier works. Without a key, tasks created with no skills simply keep none. |

Installing Bun. If you already have Node.js and npm, the quickest way is:

```sh
npm install -g bun
bun --version        # 1.3 or later
```

Otherwise use the official installer (`curl -fsSL https://bun.sh/install | bash`
on macOS/Linux, `powershell -c "irm bun.sh/install.ps1 | iex"` on Windows).

Why not `npm run` directly: the backend runs its TypeScript source natively on
Bun (`.ts` imports, `@/` path aliases, `bun --watch`), the lockfile is
`bun.lock`, and every script in the repo is a Bun command. Node.js and npm can
install Bun but cannot substitute for it. If Bun is not an option, use the
Docker path, which needs neither.

## Getting started

### Run everything in Docker

Needs only Docker (see Prerequisites); Bun is not required on the host.

```sh
cp .env.example .env                 # Postgres credentials (+ optional GEMINI_API_KEY)
docker compose up --build -d         # postgres → migrate + seed → backend → frontend
```

Open http://localhost:3000. The `migrate` service applies the migrations and
seeds the developers and skills before the backend starts, so the app is
usable as soon as `up` returns. It re-runs on every `up` and is idempotent.

> **Note on convention.** Running migrations from `docker compose up` is a
> deliberate deviation from the usual CI practice, where migrations are a
> reviewed, one-time pipeline step and application containers never touch the
> schema. It is done here so the submission is a single command to evaluate.
> The backend container itself still never migrates; only the one-shot
> `migrate` job does, and in a real deployment that job would move to CI.

```sh
docker compose logs -f               # tail everything
docker compose down                  # stop and remove containers (add -v to drop the database)
```

If you have Bun, the same commands exist as root scripts: `bun run docker:up`,
`docker:logs`, `docker:stop`, `docker:down`, and `docker:migrate` to re-run
the migrate job on its own.

Compose builds `backend/Dockerfile` and `frontend/Dockerfile`, then starts
Postgres, the migrate job, the backend on :4000 and the frontend on :3000,
each gated on the previous being healthy or finished. Ports 3000, 4000 and
5432 must be free on the host (stop `bun dev` first).

Inside the compose network the frontend's server components call the API at
`http://backend:4000` (`API_URL`, runtime), while the browser calls
`http://localhost:4000` (`NEXT_PUBLIC_API_URL`, baked into the frontend image).
Serving from another host means setting `NEXT_PUBLIC_API_URL` and
`CORS_ORIGINS` in `.env` and rebuilding. The backend runs with
`NODE_ENV=production`, so logs are at level `http` (same one-line colored
format as development).

### Develop on the host

Needs Bun and Docker (see Prerequisites).

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
Google AI Studio key works). `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`.

Without Docker: point `DATABASE_URL` at any Postgres, or run
`bun --filter backend db:dev` for Prisma's local server and paste the URL it
prints into `backend/.env`.

## Scripts

Root scripts (run from the repo root):

| Command | What it does |
| --- | --- |
| `bun run docker:up` / `docker:logs` | Build and run / tail the whole stack in Docker |
| `bun run docker:stop` / `docker:down` | Stop the containers (keep them) / remove containers and network (`-v` also drops the database) |
| `bun run docker:migrate` | Re-run the migrate + seed job on its own (`up` already runs it) |
| `bun run db:up` / `db:down` / `db:logs` | Start / stop / tail only the Postgres container |
| `bun dev` | Run backend and frontend together |
| `bun dev:backend` / `bun dev:frontend` | Run one app |
| `bun run build` | Generate client + bundle backend; `next build` |
| `bun run start` | Run the built apps |
| `bun run test` | Both test suites (the backend one needs a running, seeded database) |
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
bun run test                      # both workspaces
bun --filter backend test         # or one of them
bun --filter frontend test
```

Backend: 4 suites. Two are pure (LLM schema handling, request validation
including the size caps and strict bodies). Two drive the app over HTTP
against the real database and need `db:up`, `db:migrate` and `db:seed`
first. The LLM is always stubbed; no test needs a Gemini key. The suites
clean up every row they create.

Frontend: one pure suite, `app/_components/task-ui.test.ts`, for the helpers
that rebuild the tree from the flat list and mirror the server's two rules
(`flattenTree`, `ancestorsOf`, `hasUnfinishedSubtasks`, skill matching). No
DOM or network; runs anywhere with `bun test`.

### Continuous integration

`.github/workflows/ci.yml` runs on every push to `main` and every pull
request: `bun install --frozen-lockfile`, `bun run typecheck`, `bun run lint`,
then `db:deploy` + `db:seed` against a Postgres service container, then
`bun run test`. No deployment step yet. Environment comes from the job's `env`
block (the `.env` files are gitignored), so a new required variable must be
added there as well as to the `.env.example` files.

## System design

```
Browser ──▶ Next.js (frontend :3000) ──▶ Express API (backend :4000) ──▶ Postgres
              server components prefetch;      Prisma 7 (pg adapter)
              React Query on the client        └──▶ Google Gemini (skill inference)
```

- **Two services, one contract.** The backend owns the data model
  (`backend/db/schema.prisma`) and exposes JSON over REST. The frontend is one
  page that renders the task list server-side, hydrates a React Query cache,
  and mutates through the same API from the browser. It re-declares the API
  types by hand in `frontend/types/`.
- **Layered backend.** Each resource is a folder with four files: `route`
  (paths), `controller` (HTTP in, JSON out), `service` (every Prisma call and
  every business rule), `validator` (Zod request shapes). Validation failures
  are 422, missing rows 404, refused rules 409, all through one error handler.
- **Rules live in the service, not the database.** The two business rules
  (skill-gated assignment, all-subtasks-done completion) span join tables and
  cannot be expressed as constraints, so `tasks.service.ts` enforces them on
  every write path and says why in the 409 body (`missingSkills`,
  `unfinishedSubtasks`). The frontend mirrors both rules to disable the
  offending option up front; the server stays the authority.
- **Subtasks as a self-relation.** `Task.parentId` points at the parent, with
  cascade delete. Depth and breadth are capped by constants duplicated in both
  apps. A task tree is created in one transaction from one nested body; the
  list endpoint stays flat and the client rebuilds the tree.
- **LLM inference is a best-effort step inside create.** Nodes sent without
  skills are classified by Gemini using structured output constrained to an
  enum of the skill names that exist in the database, then re-validated with
  Zod. Any failure (no key, timeout, quota, off-shape reply) logs a warning and
  leaves the node without skills; a create never fails because of the model.
- **Configuration is validated at boot** (`backend/src/lib/env.ts`), and every
  request carries an `X-Request-Id` that all of its log lines share.

## API

Base URL `http://localhost:4000`. Bodies are JSON. Errors are
`{ "error": string, "details"?: object }` at the status listed.

| Method | Path | Body | Success | Errors |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | | `200 { status, uptime }` | |
| `GET` | `/api/tasks` | | `200 { tasks: Task[] }` flat, newest first | |
| `GET` | `/api/tasks/:id` | | `200 { task }` | 404; 422 bad uuid |
| `POST` | `/api/tasks` | `CreateTask` (below) | `201 { task }` root row | 409 rule refused; 422 invalid body or unknown skill/developer |
| `PATCH` | `/api/tasks/:id` | `{ assigneeId: uuid \| null }` | `200 { task }` | 404; 409 `details.missingSkills`; 422 |
| `PATCH` | `/api/tasks/:id/status` | `{ status: "todo" \| "in_progress" \| "done" }` | `200 { task }` | 404; 409 `details.unfinishedSubtasks`; 422 |
| `GET` | `/api/developers` | | `200 { developers: Developer[] }` with `skills` | |
| `GET` | `/api/developers/:id` | | `200 { developer }` | 404; 422 |
| `GET` | `/api/skills` | | `200 { skills: Skill[] }` | |
| `GET` | `/api/skills/:id` | | `200 { skill }` | 404; 422 |

`Task` is `{ id, title, description, status, assigneeId, parentId, createdAt,
updatedAt, assignee: Developer | null, requiredSkills: Skill[] }`. Only
`assigneeId` and `status` can change after creation, each through its own
route. Unknown fields in any body are rejected with a 422.

`CreateTask`, recursive through `subtasks`:

```json
{
  "title": "As a visitor, I want a responsive homepage",
  "description": "optional",
  "status": "todo",
  "assigneeId": null,
  "requiredSkillIds": [],
  "subtasks": [{ "title": "Build the layout", "requiredSkillIds": ["<skill uuid>"] }]
}
```

Omit or empty `requiredSkillIds` on any node and the server infers them from
the title with Gemini (when `GEMINI_API_KEY` is set). The assignment rule is
then judged against the inferred skills, so an `assigneeId` on a skill-less
node can still be refused with a 409. Limits: 4 levels of nesting, 20 direct
subtasks per task, 50 tasks per create, each a 422 with the limit in
`details`. Reopening a `done` task (to `todo` or `in_progress`) also reopens
every `done` ancestor to `in_progress` in the same transaction.

```sh
curl -s localhost:4000/api/tasks -H 'content-type: application/json' \
  -d '{"title":"As a visitor, I want to see a responsive homepage"}'
# 201 {"task":{..., "requiredSkills":[{"name":"Frontend", ...}]}}
```

## Dependencies and why

Backend:

| Package | Why |
| --- | --- |
| `express` 5 | Minimal, well-known HTTP framework; v5 forwards rejected promises to the error handler, so async controllers need no wrapper. |
| `@prisma/client`, `prisma`, `@prisma/adapter-pg` | Schema-first ORM: one `schema.prisma` yields migrations, a typed client, and the types the services return. The pg adapter is how Prisma 7 connects to Postgres. |
| `zod` | Request validation with inferred TypeScript types and readable field errors. Also converts to the JSON Schema sent to Gemini, so the model is constrained by the same definition its reply is checked against. |
| `@google/genai` | Google's official Gemini SDK with structured-output support. Gemini was chosen for its free tier, as the brief suggests. |
| `http-errors` | Errors that carry their HTTP status, so services throw and one handler responds. |
| `helmet` | Standard security headers; hides `X-Powered-By`. |
| `cors` | Allows only the configured frontend origin(s). |
| `winston` | Levelled logging with a per-request child logger. |

Frontend:

| Package | Why |
| --- | --- |
| `next` 16, `react` 19 | React framework with server components: the first paint is server-rendered with real data, the rest behaves as a normal SPA. |
| `@tanstack/react-query` | Server-state cache hydrated from the server prefetch; optimistic updates with rollback for the two mutations. |
| `react-hook-form` | Uncontrolled form state; `useFieldArray` makes the recursive subtask form cheap to render at any depth. |
| `nuqs` | Type-safe URL search-param state, so the active filter and the open task are shareable links. |
| `tailwindcss` 4, `radix-ui`, shadcn/ui (`class-variance-authority`, `cmdk`, `cn`, `lucide-react`, `tw-animate-css`) | Utility CSS plus accessible headless primitives; shadcn components are copied into `components/ui/` and owned by the repo. |
| `sonner` | Toasts for mutation results and errors. |

Tooling: Bun as runtime, package manager and test runner for both workspaces;
strict TypeScript in both; ESLint (`eslint-config-next`) on the frontend.

## Further reading

- [`backend/README.md`](backend/README.md) — API details, logging, inference
- [`frontend/README.md`](frontend/README.md) — app structure, state management
