@AGENTS.md

# frontend

Next.js 16 App Router, React 19, Tailwind 4, shadcn/ui, TypeScript. Read
`AGENTS.md` first — this Next version breaks older conventions and vendors its
docs in `node_modules/next/dist/docs/`.

State libraries: `@tanstack/react-query` (server state), `react-hook-form`
(forms, no `zod`, no shadcn `form` wrapper), `nuqs` (URL state). Don't add
alternatives.

## Layout

```
app/
  layout.tsx               # Geist fonts, Providers, TooltipProvider, Toaster
  page.tsx                 # server component: prefetch → HydrationBoundary → <TaskManager/>
  error.tsx                # route error boundary; queries throwOnError into it
  providers.tsx            # NuqsAdapter + QueryClientProvider
  _components/             # route-private; task-manager.tsx is the one client shell
  _hooks/                  # use-task-mutations.ts, use-task-search-params.ts
  globals.css              # Tailwind + shadcn tokens; light mode only
components/ui/             # shadcn output — copied source, ours to edit; + side-panel.tsx
lib/api.ts                 # typed fetch client; throws ApiError({ status, details })
lib/constants.ts           # subtask caps, mirrored from the backend — keep equal
lib/queries.ts             # queryOptions shared by server prefetch and client hooks
lib/query-client.ts        # per-request on the server, singleton in the browser
types/                     # hand-maintained API contract; import via `@/types`
```

Single-page app. Route-private code lives in `app/_components` and
`app/_hooks`; `components/` is for shared pieces only.

## Rules

- **Server first.** `page.tsx` stays a server component. `"use client"` goes on
  the component that needs state, not the page. `TaskManager` is the client
  boundary; it sits under `Suspense` because nuqs uses `useSearchParams`.
- **URL state via nuqs**, in `use-task-search-params.ts`: `?filter=` (default
  `all`, dropped from URL) and `?task=<id>` (open detail panel). Add new
  shareable state there, not as `useState`. The create panel is local.
- **Server state via React Query.** Query definitions live only in
  `lib/queries.ts`. `page.tsx` prefetches tasks, developers and skills;
  `prefetchQuery` swallows failures so the client refetches and, via
  `throwOnError`, lands in `error.tsx`. Components never read `query.error`.
- **Mutations** in `use-task-mutations.ts`. A task changes in exactly two ways
  after creation, mirrored by `TaskPatch`: `{ assigneeId }` → `PATCH /:id`,
  `{ status }` → `PATCH /:id/status`. Updates are optimistic against the list,
  rolled back and toasted on error. `describeError()` formats the two 409s.
- **`types/` is hand-maintained.** It duplicates the backend contract derived
  from `backend/db/schema.prisma`; nothing checks agreement. One file per
  domain plus `api.ts`; import through the `@/types` barrel. Enum values are
  the DB's lowercase strings under PascalCase keys (`TaskStatus.InProgress`).
  Verify against a live response, not a backend type — the backend has none.
- **Path alias `@/*`** maps to the app root; imports omit extensions (unlike
  the backend).
- **Tailwind only.** Colors through `@theme inline` tokens in `globals.css`.
  Light mode only: no `dark:` utilities, no dark token block. If `shadcn add`
  writes one back, remove it.
- `bun run lint`, `bun run typecheck` and `bun test` pass; keep them passing.
  The only suite is `app/_components/task-ui.test.ts` (pure helpers, no DOM);
  add tests for new pure logic there or beside it.

## Subtasks

The API returns a **flat** list; rows carry `parentId`. `task-ui.ts` builds
the tree: `flattenTree()` (depth-first rows, collapsed unless in the `expanded`
set `TaskManager` owns), `ancestorsOf()`, `childrenOf()`,
`hasUnfinishedSubtasks()` (mirrors the server's completion rule so "Done" is
withheld up front; the server still 409s).

Subtasks are created only inline from the create panel. Form state is the
recursive `TaskFormValues`; `TaskFormFields` renders one task at a `path`
(`""`, `"subtasks.0."`, …) and `SubtaskList` is `useFieldArray` that renders
`TaskFormFields` + itself per entry, keyed by `field.id`. "Add subtask" is
withheld once any cap in `lib/constants.ts` is hit.

Required skills are optional at every level: a node sent with none has them
inferred server-side from its title. The assignee select is disabled until
skills are picked, because the server judges the assignment rule against the
inferred skills.

## shadcn/ui

Add components from this directory (`components.json` lives here):

```sh
bunx --bun shadcn@latest add <name>
```

Style `radix-nova`, base `neutral`, imports from the single `radix-ui`
package. `cn` comes from the `cn` package via `lib/utils.ts`. Installed:
alert-dialog, avatar, badge, button, card, checkbox, command, dialog,
dropdown-menu, input, input-group, label, popover, select, separator, sheet,
skeleton, sonner, switch, table, tabs, textarea, tooltip.

Post-init edits that must survive regeneration:

- `globals.css`: `--font-sans: var(--font-geist-sans)` (init emits a
  self-reference); no dark block; `:root { color-scheme: light }`.
- `components/ui/sonner.tsx`: `next-themes` removed, `theme="system"` passed
  directly. Re-apply rather than installing `next-themes`.
- `TooltipProvider` and `Toaster` are wired once in `app/layout.tsx`.

## Talking to the backend

Everything goes through `lib/api.ts`: `NEXT_PUBLIC_API_URL` (default
`http://localhost:4000`), `cache: "no-store"`. `NEXT_PUBLIC_*` is inlined at
build time — changing it means a rebuild. Put it in `.env.local`. On the
server a runtime `API_URL` takes precedence when set; the Docker stack uses it
so server components reach `http://backend:4000` while the browser keeps the
public URL. `next.config.ts` sets `output: "standalone"` for the image.

## Commands

```sh
bun run dev | build | typecheck | lint | test   # or bun --filter frontend <script>
```
