# backend

REST API for the task-assignment app. Express 5 on the Bun runtime, Prisma 7
over Postgres, Zod request validation, Winston logging, and Google Gemini for
optional skill inference.

## Running

From the repo root (see the root README for first-time setup):

```sh
bun run db:up                     # Postgres in Docker (bun run docker:up runs the whole stack)
bun --filter backend db:migrate
bun --filter backend db:seed
bun dev:backend                   # bun --watch src/index.ts on :4000
```

Or from this directory: `bun run dev`, `bun run build` (bundles to `dist/`),
`bun run start`, `bun run typecheck`, `bun test`.

## Configuration

`backend/.env` (copy from `.env.example`). Every variable is validated at boot
by `src/lib/env.ts`; a bad value fails startup with a message naming it.

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | required | Postgres connection string |
| `PORT` | `4000` | |
| `NODE_ENV` | `development` | `development`, `test` or `production` |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed origins |
| `LOG_LEVEL` | `debug` (dev), `http` (prod) | Winston threshold: `error`, `warn`, `info`, `http`, `debug` |
| `GEMINI_API_KEY` | empty | Enables skill inference. Empty disables it. |
| `GEMINI_MODEL` | `gemini-3.5-flash` | |

## Logging

Winston. One human-readable colored line per entry in every environment (no
JSON mode). Every response carries `X-Request-Id`
(an incoming `x-request-id` is honored), and every log line from that request
carries the same id. An access line is written per request at `http` (2xx/3xx),
`warn` (4xx) or `error` (5xx). Under `NODE_ENV=test` logging is silent unless
`LOG_LEVEL` is set.

## Database

Schema: `db/schema.prisma`. Migrations: `db/migrations/`. Prisma is configured
by `prisma.config.ts` (schema path, migrations path, seed command,
`DATABASE_URL`), which is why the schema can live outside the conventional
`prisma/` folder. The client is generated into `src/generated/prisma/`
(gitignored) on `bun install`.

After changing the schema: `bun run db:migrate`, then update
`frontend/types/` by hand — nothing checks the two agree.

## Structure

```
db/                 Prisma schema, migrations and seed script
prisma.config.ts    Prisma config: schema path, migrations path, DATABASE_URL
src/
  app.ts            Express app factory
  index.ts          entry point
  db/               Prisma client
  lib/              env, logging, validation, LLM client, constants
  services/         one folder per resource (tasks, developers, skills), each
                    split into route, controller, service and validator
```

## Tests

```sh
bun test            # from this directory; or `bun run test` from the root
```

Four suites next to the code they cover. `lib/llm.test.ts` and
`tasks.validator.test.ts` are pure. `tasks.test.ts` and `skills.test.ts`
start the app in-process and drive it over HTTP against the real database, so
they need `db:up`, `db:migrate` and `db:seed`. The Gemini client is stubbed;
no test needs a key. Every row a test creates is deleted afterwards.
