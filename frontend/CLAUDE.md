@AGENTS.md

# frontend

Next.js 16.3.4 App Router, React 19.2, Tailwind 4, TypeScript. Runs on :3000.
Read `AGENTS.md` first — this Next version has breaking changes from older
conventions, and the docs are vendored in `node_modules/next/dist/docs/`.

Dependencies are only `next`, `react`, `react-dom`. No data-fetching library,
no component library, no form library, no `zod` — add one only if asked.

## Layout

```
app/
  layout.tsx           # root layout, Geist fonts, metadata
  page.tsx             # the task list — an async server component
  globals.css          # @import "tailwindcss" + @theme inline tokens
lib/
  api.ts               # typed fetch client for the backend
  types.ts             # the API contract, hand-maintained (see below)
next.config.ts         # sets turbopack.root to the repo root
```

There are no client components yet — `page.tsx` fetches on the server. Keep it
that way unless you actually need interactivity; add `"use client"` only on the
component that needs it, not the page.

## types.ts is hand-maintained — this is the sharp edge

`lib/types.ts` duplicates the backend's API contract, which is derived from
`backend/db/schema.prisma`. There is no shared package and **no compiler check
that the two agree**.

If a schema field changes, this file must change with it. Neither `typecheck`
nor `lint` will fail if it drifts — you'll get wrong types that silently
compile, or runtime data that doesn't match its type. When touching anything
task-shaped, diff it against `backend/src/services/tasks/tasks.types.ts`.

Enum values are the DB's lowercase strings (`"in_progress"`), exposed as const
objects with PascalCase keys (`TaskStatus.InProgress`) — the keys differ from
the backend's generated enums, the values do not.

## Talking to the backend

All requests go through `lib/api.ts`. It reads `NEXT_PUBLIC_API_URL`
(default `http://localhost:4000`) and sets `cache: "no-store"`, because task
data is mutable and must not be served from the build cache.

`NEXT_PUBLIC_*` is inlined at build time, not read at runtime — changing the
API URL means a rebuild. Put it in `.env.local` (gitignored);
`.env.example` is the committed reference.

`api.ts` throws on a non-2xx response. `page.tsx` catches that and renders an
error panel rather than crashing the route — keep that pattern, since the
backend is a separate process that may simply be down.

## Conventions

- Path alias `@/*` maps to the app root (`@/lib/api`). Imports here omit file
  extensions — unlike the backend, which uses explicit `.ts`.
- Tailwind utilities only; no CSS modules or styled-components. Colors go
  through the `@theme inline` tokens in `globals.css`, and every surface needs
  a `dark:` variant — the existing page has them throughout.
- `bun run lint` (eslint, flat config) and `bun run typecheck` both pass. Keep
  them passing.

## Commands

Run from here or as `bun --filter frontend <script>`:

```sh
bun run dev            # next dev (Turbopack)
bun run build          # next build
bun run typecheck      # tsc --noEmit
bun run lint           # eslint
```

There are no frontend tests, and no test runner is configured.
