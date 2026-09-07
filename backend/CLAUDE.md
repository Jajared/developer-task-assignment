# backend

Express 5 on the Bun runtime, Prisma 7 over Postgres. Deps: `express`, `cors`,
`zod`, `@prisma/client`, `@prisma/adapter-pg`.

## Layout

```
db/
  schema.prisma        # models + enums — source of truth for tables AND types
  seed.ts              # idempotent; no-op if the table has rows
  migrations/          # the initial migration lives here
prisma.config.ts       # schema path, migrations path, seed cmd, DATABASE_URL
src/
  app.ts               # createApp(); /health is inline here; mount routers here
  index.ts             # binds the port, $disconnect on SIGINT/SIGTERM
  env.ts               # every process.env read; DATABASE_URL throws if missing
  db/prisma.ts         # PrismaClient singleton, cached on globalThis for --watch
  generated/prisma/    # generated client — GITIGNORED, never edit, never commit
  lib/http-error.ts    # HttpError: an error that carries its HTTP status
  lib/validate.ts      # parseOrThrow(): ZodError → 422 HttpError
  lib/log.ts           # log() / logVerbose(); verbose is silent in production
  test-utils.ts        # request() / send() helpers; boot on an ephemeral port
  services/tasks/
    tasks.route.ts        # path → controller
    tasks.controller.ts   # HTTP in/out only
    tasks.service.ts      # business logic + Prisma queries
    tasks.validator.ts    # Zod schemas + validateX() functions
  services/developers/    # same four files; read-only
  services/skills/        # same four files; read-only
```

Three services: `tasks/` (full CRUD), `developers/` and `skills/` (read-only —
both are seeded reference data, and there are no write routes for them).
`/health` is deliberately *not* a service — it's three lines in `app.ts`.

There are no test files at the moment; `test-utils.ts` is kept for when they
come back.

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
- **Relations are pulled with `include`,** written inline on each query
  (`include: { assignee: true, requiredSkills: { orderBy: { name: "asc" } } }`).
  There is no shared select constant and no `GetPayload` row type.
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
- **Services export plain functions, named for the entity** — `listTasks`,
  `findTaskById`, `createTask`, `updateTask`, `deleteTask`; `listSkills`,
  `findSkillById`. Not one object of methods. Controllers import the module as
  a namespace (`import * as taskService from "./tasks.service.ts"`), so call
  sites read `taskService.findTaskById(id)`.
- **Service functions declare no return type** — it's inferred from the query
  plus `serialize()`. There are no DTO types and no `.types.ts` files; a
  caller that needs the shape reads it off the function
  (`Awaited<ReturnType<typeof findTaskById>>`).
- **Validators are functions, not middleware.** Each schema is module-private;
  the file exports `validateCreateTask(payload: unknown): TCreateTask` and
  friends, built on `parseOrThrow` from `lib/validate.ts`. The controller calls
  them inside its `try`, so routes are just `path → controller`. Types are
  `z.infer` with a `T` prefix (`TCreateTask`, `TUpdateTask`, `TTaskId`).
  Derive allowed values from the Prisma enums (`z.nativeEnum`) so the API
  rejects what the column would, `.trim()` strings, and give every rule a
  message a person can read.
- **Route params are validated too** — `validateTaskId(req.params)`, so a
  malformed uuid is a 422 with a field error rather than a silent 404.
- **Controllers have the full Express signature** and route errors to `next`:

  ```ts
  async function createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
    logVerbose("Create task", req.body);
    try {
      const payload = taskValidator.validateCreateTask(req.body);
      respond(res, await taskService.createTask(payload), 201);
    } catch (error) {
      next(error);
    }
  }

  export { getTasks, getTask, createTask, updateTask, updateTaskStatus, deleteTask };
  ```

  Declare the handlers, then export them in one block at the bottom.
- **Throw `HttpError` to choose a status from anywhere** — validator, service,
  controller. The error handler in `app.ts` sends `{ error, details }` at
  `err.status`; anything else is a bug and becomes a 500. Never throw it for
  one.
- **Prisma rows are returned as-is.** No DTO, no mapping step. `res.json()`
  calls `Date.prototype.toJSON`, so every timestamp reaches the client as an
  ISO string with nothing in between — the *types* say `Date`, the wire says
  string. That gap is deliberate; don't reintroduce a mapper to close it
  without a reason beyond tidiness.

  The consequence to remember: a row's columns are the response. Add a column
  to `schema.prisma` and it appears in the API immediately, so there's nowhere
  to hide a field that shouldn't be public.
- **Services throw, they don't return failures.** A service function returns
  the thing or throws an `HttpError` — no `undefined`-for-not-found, no result
  union, and no mapping helper in the controller.
- **Services take an `id: string` and trust it.** There is no uuid guard in the
  service layer: `validateTaskId(req.params)` runs first in every handler that
  has an `:id`, so a malformed id is a 422 before any query is built and never
  reaches the `uuid` column. A new id route must validate its param the same
  way, or a bad id becomes a Postgres error and a 500.

  That keeps every handler down to its success path:

  ```ts
  const { id } = taskValidator.validateTaskId(req.params);
  const task = await taskService.findTaskById(id);
  res.status(200).json({ task });
  ```
- **Relative imports carry the `.ts` extension** (`./tasks.service.ts`).
- **Read env only in `env.ts`.**

## Status codes

201 on create, 204 on delete, 404 for a missing row, 422 for a Zod failure
(not 400 — the body parsed, it just failed the schema) and for a body naming a
row that doesn't exist. The JSON 404 fallback and the 500 handler are in
`app.ts`.

**409 is the interesting one.** A task may only be assigned to a developer who
holds every skill it requires. That rule lives in `assertAssignable()` in
`tasks.service.ts` and is judged against the state the task will have *after*
the write — so it catches both directions: assigning a developer who lacks a
skill, and adding a required skill to a task someone already holds. The
response names what's missing:

```json
{
  "error": "Developer lacks the skills this task requires",
  "details": { "missingSkills": [{ "id": "…", "name": "Frontend" }] }
}
```

Nothing in the database enforces this — the join tables are independent — so
any new write path has to run the same check.

## Database workflow

After editing `db/schema.prisma`:

```sh
bun run db:up                    # from the repo root — starts Postgres
bun run db:migrate               # migration + regenerates the client
```

Also: `db:generate`, `db:deploy`, `db:push`, `db:seed`, `db:studio`,
`db:reset`, and `db:dev` (Prisma's own local Postgres, if you skip Docker).

Then update `frontend/lib/types.ts` by hand — nothing enforces that it matches.
The backend no longer declares response types, so check it against an actual
response (`curl localhost:4000/api/tasks`), not against a type.

## Routes

```
GET    /health
GET    /api/tasks                 list, newest first
GET    /api/tasks/:id
POST   /api/tasks                 201
PATCH  /api/tasks/:id             partial; assignment rule applies
PATCH  /api/tasks/:id/status      status only — registered BEFORE /:id
DELETE /api/tasks/:id             204
GET    /api/developers            each with their skills
GET    /api/developers/:id
GET    /api/skills
GET    /api/skills/:id
```

A task's writable relations are ids: `assigneeId` and `requiredSkillIds`
(which replaces the whole set). Reads return them nested as `assignee` and
`requiredSkills`, each a **whole row** — `assignee` carries its own
timestamps, `requiredSkills` entries carry theirs.

## Testing

**There are no tests right now** — they were removed to be written later, so
`bun test` runs nothing. `test-utils.ts` is still here: it drives the real app
over HTTP on an ephemeral port.

When they come back: they **need a running database** and share one, so don't
assert on absolute row counts, and read the seeded skills/developers from the
API rather than hardcoding names or ids.
