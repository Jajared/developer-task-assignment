# task-assignment-app

A Bun monorepo: an Express backend backed by Prisma/Postgres, and a Next.js
frontend.

```
task-assignment-app/
├── backend/                  # Express 5 API (Bun runtime), port 4000
│   ├── db/
│   │   ├── schema.prisma     # models, enums — source of truth for the DB
│   │   ├── migrations/       # generated SQL, committed (created by db:migrate)
│   │   └── seed.ts
│   ├── prisma.config.ts      # points Prisma at db/ and supplies DATABASE_URL
│   └── src/
│       ├── app.ts            # app + /health; mount routers here
│       ├── index.ts          # binds the port, closes the pool on shutdown
│       ├── env.ts            # config from env vars
│       ├── db/prisma.ts      # PrismaClient singleton
│       ├── generated/prisma/ # generated client (gitignored)
│       └── services/
│           └── tasks/
│               ├── tasks.controller.ts   # HTTP in/out
│               ├── tasks.route.ts        # path → validator → controller
│               ├── tasks.service.ts      # business logic + Prisma queries
│               ├── tasks.validator.ts    # Zod request schemas + middleware
│               ├── tasks.types.ts        # row + API shapes
│               └── tasks.test.ts
├── frontend/                 # Next.js 16 App Router + Tailwind 4, port 3000
│   ├── app/
│   └── lib/
│       ├── api.ts            # typed client for the backend
│       └── types.ts          # the API contract as the frontend sees it
├── docker-compose.yml        # Postgres only; the apps run on the host
└── package.json              # Bun workspaces + root scripts
```

## Getting started

Postgres runs in Docker; both apps run on the host.

```sh
bun install
cp backend/.env.example backend/.env

bun run db:up                      # starts Postgres on :5432
bun --filter backend db:migrate    # creates the tables
bun --filter backend db:seed       # optional sample rows
bun dev                            # backend + frontend together
```

The default `DATABASE_URL` in `.env.example` already matches the compose
service, so no edit is needed. Two alternatives if you would rather not use
Docker: point `DATABASE_URL` at your own Postgres, or run
`bun --filter backend db:dev` for Prisma's built-in local server and copy the
URL it prints into `backend/.env`.

- Frontend — http://localhost:3000
- Backend — http://localhost:4000 (`GET /health` to check it)

## Scripts

Root scripts fan out to both workspaces:

| Command | What it does |
| --- | --- |
| `bun run db:up` / `db:down` | Starts / stops the Postgres container |
| `bun run db:logs` | Tails the Postgres logs |
| `bun dev` | Runs backend and frontend together |
| `bun dev:backend` / `bun dev:frontend` | Runs just one |
| `bun run build` | Generates the client + bundles the backend, builds the frontend |
| `bun test` | Runs the backend test suite (needs a database) |
| `bun run typecheck` | Typechecks both apps |
| `bun run lint` | ESLint on the frontend |

Database scripts live in the backend workspace — `bun --filter backend <name>`:

| Script | What it does |
| --- | --- |
| `db:dev` | Prisma's own local Postgres, as an alternative to Docker |
| `db:migrate` | Creates and applies a migration from schema changes |
| `db:deploy` | Applies existing migrations (for deployed environments) |
| `db:push` | Pushes the schema without writing a migration |
| `db:generate` | Regenerates the Prisma client |
| `db:seed` | Inserts sample rows (no-op if the table is non-empty) |
| `db:studio` | Opens Prisma Studio |
| `db:reset` | Drops, re-migrates, and re-seeds |

## Prisma layout

The schema lives in `backend/db/schema.prisma`, not the conventional `prisma/`
directory. `backend/prisma.config.ts` is what makes that work — it declares the
schema path, the migrations path, the seed command, and the datasource URL.
Prisma 7 no longer reads `DATABASE_URL` from the schema's datasource block, so
this file is required, not optional.

The client is generated into `backend/src/generated/prisma` and is
**gitignored** — `postinstall` regenerates it, so a fresh clone only needs
`bun install`.

Prisma 7 talks to Postgres through a driver adapter (`@prisma/adapter-pg`)
rather than a native query engine, so the connection string is passed to
`PrismaClient` in `src/db/prisma.ts`.

## Types

There is no shared package. The schema's enums are the source of truth:

- The **backend** imports `TaskStatus` / `TaskPriority` from the generated
  client, so the Zod request schemas in `tasks.validator.ts` reject anything
  the database column would. `tasks.types.ts` holds the row type and the API
  shape (`Date` columns serialized to ISO strings).
- The **frontend** declares the same contract by hand in `lib/types.ts`.
  Nothing enforces that the two agree, so when you change the schema, update
  `frontend/lib/types.ts` to match.

## API

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/health` | Liveness + uptime, defined inline in `app.ts` |
| `GET` | `/api/tasks` | List tasks, newest first |
| `GET` | `/api/tasks/:id` | One task, 404 if missing |
| `POST` | `/api/tasks` | Create; 422 on schema failure |
| `PATCH` | `/api/tasks/:id` | Partial update |
| `DELETE` | `/api/tasks/:id` | 204 on success |

## Adding a service

1. Add the model to `backend/db/schema.prisma`, then
   `bun --filter backend db:migrate`.
2. `mkdir backend/src/services/<name>`
3. Add `<name>.service.ts` (Prisma queries), `<name>.controller.ts` (HTTP),
   `<name>.route.ts` (wiring), `<name>.validator.ts` (Zod schemas bound as
   route middleware), and `<name>.types.ts`.
4. Mount the router in `backend/src/app.ts`.
