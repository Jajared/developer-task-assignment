# backend

Express 5 on the Bun runtime, Prisma 7 over Postgres. Deps: `express`, `cors`,
`zod`, `@prisma/client`, `@prisma/adapter-pg`.

## Layout

```
db/
  schema.prisma        # models + enums — source of truth for tables AND types
  seed.ts              # idempotent; no-op if the table has rows
  migrations/          # not created yet — appears on first db:migrate
prisma.config.ts       # schema path, migrations path, seed cmd, DATABASE_URL
src/
  app.ts               # createApp(); /health is inline here; mount routers here
  index.ts             # binds the port, $disconnect on SIGINT/SIGTERM
  env.ts               # every process.env read; DATABASE_URL throws if missing
  db/prisma.ts         # PrismaClient singleton, cached on globalThis for --watch
  generated/prisma/    # generated client — GITIGNORED, never edit, never commit
  test-utils.ts        # request() / send() helpers; boot on an ephemeral port
  services/tasks/
    tasks.route.ts        # path → validator → controller
    tasks.controller.ts   # HTTP in/out only
    tasks.service.ts      # business logic + Prisma queries
    tasks.validator.ts    # Zod request schemas, bound as route middleware
    tasks.types.ts        # TaskRow (Prisma) + Task (API shape) + envelopes
    tasks.test.ts
```

`tasks/` is currently the only service. `/health` is deliberately *not* a
service — it's three lines in `app.ts`.

## Prisma 7 gotchas

These cost real time if you don't know them:

- **The schema is at `db/schema.prisma`, not `prisma/`.** `prisma.config.ts` is
  the only reason that works — it declares the schema and migrations paths.
  Delete or move it and every Prisma command fails with "file not found"
  (it only looks in `prisma/` or the repo root). Don't "tidy" it away.
- **Prisma 7 does not read `DATABASE_URL` from the schema's datasource block.**
  It comes from `prisma.config.ts`, which reads `process.env`. Bun loads `.env`,
  so run the CLI through the package scripts.
- **The generated row type is `TaskModel`, not `Task`** — the `prisma-client`
  generator suffixes model types. Import it from `generated/prisma/models.ts`.
- **Enums come from `generated/prisma/enums.ts`** as const objects with
  lowercase keys (`TaskStatus.in_progress`), matching the schema values exactly.
- **No native query engine.** Prisma 7 uses a driver adapter, so `PrismaPg` gets
  the connection string in `src/db/prisma.ts`. This is why `pg` is a transitive
  dependency — that's the supported path, not a workaround.
- **Pin the CLI to `^7`.** `bun add -d prisma` resolves to an `8.0.0-rc`
  prerelease that mismatches the v7 client.

## Conventions

- **One folder per service** under `src/services/`, files named
  `<service>.<layer>.ts`. Mount its router in `app.ts`.
- **Layers stay in their lane.** Controllers do HTTP; services own every Prisma
  call; validators own request shape. A controller should never build a `where`.
- **Validation lives beside the route**, not in a shared middleware folder.
  `validateBody` is local to `tasks.validator.ts`. Derive allowed values from
  the Prisma enums (`z.nativeEnum`) so the API rejects what the column would.
- **Prisma rows never reach the response.** Map through `toDto()` in the
  service — that's where `Date` becomes an ISO string.
- **Services return `undefined` for not-found**; the controller turns that into
  a 404. Two guards make that work: `asId()` screens non-UUIDs before they hit
  the `uuid` column, and `isRecordNotFound()` catches Prisma's `P2025`.
- **Relative imports carry the `.ts` extension** (`./tasks.service.ts`).
- **Read env only in `env.ts`.**
- Controllers are `async`; Express 5 forwards a rejected promise to the error
  handler in `app.ts` on its own, so they can throw.

## Status codes

422 for Zod validation failure (not 400), 404 for a missing row, 204 on delete,
201 on create. The JSON 404 fallback and the 500 handler are in `app.ts`.

## Database workflow

After editing `db/schema.prisma`:

```sh
bun run db:up                    # from the repo root — starts Postgres
bun run db:migrate               # migration + regenerates the client
```

Also: `db:generate`, `db:deploy`, `db:push`, `db:seed`, `db:studio`,
`db:reset`, and `db:dev` (Prisma's own local Postgres, if you skip Docker).

Then update `frontend/lib/types.ts` by hand — nothing enforces that it matches.

## Testing

`bun test`. Tests drive the real app over HTTP via `test-utils.ts` and **need a
running database** — they have never been run against Prisma, so expect to fix
fallout. They share one database, so don't assert on absolute row counts.
