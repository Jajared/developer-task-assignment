@AGENTS.md

# frontend

Next.js 16.3.4 App Router, React 19.2, Tailwind 4, TypeScript. Runs on :3000.
Read `AGENTS.md` first — this Next version has breaking changes from older
conventions, and the docs are vendored in `node_modules/next/dist/docs/`.

Dependencies are `next`, `react`, `react-dom` plus shadcn/ui and what it
pulls in (`radix-ui`, `class-variance-authority`, `cn`, `lucide-react`,
`tw-animate-css`, `cmdk`, `sonner`), plus `react-hook-form` for form state
`@tanstack/react-query` for server state and `nuqs` for URL state (see
**URL state** below). No `zod` — add it only if asked. Forms use
`useForm` directly with inline `validate` rules (see
`app/_components/create-task-panel.tsx`); `Controller` wraps the non-native
inputs such as the shadcn `Select` and the skill toggle chips. The create form
is recursive — see **Subtasks** below.

## Layout

```
app/
  layout.tsx           # root layout, Geist fonts, metadata,
                       #   TooltipProvider + Toaster
  page.tsx             # the task list — a server component that prefetches
                       #   into React Query and hydrates the client shell
  error.tsx            # the route's error boundary; queries throwOnError into it
  providers.tsx        # NuqsAdapter + QueryClientProvider, wired in layout.tsx
  _components/         # components private to this route (see below)
    task-manager.tsx        # the client shell: heading, filters, list, panels
    task-table.tsx          # the list at md and up; task-cards.tsx below md
    task-row-title.tsx      # expander + title cell shared by both lists
    create-task-panel.tsx   # the create form: root fields + SubtaskList
    task-form-fields.tsx    # one task's fields, bound at a form path; TaskFormValues
    subtask-fields.tsx      # SubtaskList/SubtaskCard — the recursive field array
    skill-picker.tsx        # required-skill toggle chips
    task-ui.ts              # labels, styles, tree helpers (flattenTree, childrenOf…)
  _hooks/              # route-private hooks: React Query mutations and
                       #   use-task-search-params.ts, the nuqs URL state
  globals.css          # tailwind + shadcn theme tokens (see below)
components/
  ui/                  # shadcn/ui components — generated, ours to edit —
                       #   plus side-panel.tsx, our Sheet wrapper
lib/
  api.ts               # typed fetch client for the backend; throws ApiError
  queries.ts           # queryOptions shared by server prefetch and client hooks
  query-client.ts      # getQueryClient(): per-request on the server, singleton in the browser
  types.ts             # the API contract, hand-maintained (see below)
  utils.ts             # re-exports `cn` (shadcn's clsx + tailwind-merge)
components.json        # shadcn config: radix-nova style, neutral base
next.config.ts         # sets turbopack.root to the repo root
```

This is a single-page app. Route-private components live in `_components/`
and route-private hooks in `_hooks/`, both next to the route (`app/_components/`
and `app/_hooks/` for the only page today); the root `components/` directory is
for shared pieces only, which so far means `components/ui/`.

Render on the server wherever possible. `page.tsx` is a server component and
stays one; add `"use client"` only on the component that actually needs state
or handlers, not the page. `app/_components/task-manager.tsx` is the one
client boundary — it owns the expanded-rows set and the create panel, and
reads the filter and open task from the URL (see **URL state**) — and renders
the page heading itself. `page.tsx` wraps it in `Suspense` because nuqs uses `useSearchParams`,
which Next refuses to prerender without a boundary; the route is dynamic, so
the fallback never actually shows. Helpers in `task-ui.ts` and presentational bits (`skill-badge`,
`developer-avatar`) have no directive so they work on either side.

## URL state

The list filter and the open task are query params, managed by `nuqs` so a
view can be linked to or reloaded: `?filter=in_progress` (one of
`FILTER_VALUES`; `all` is the default and is dropped from the URL, unknown
values fall back to it) and `?task=<id>` (absent when the panel is closed).
`app/_hooks/use-task-search-params.ts` owns both: `taskSearchParams` is the
parser map, kept separate so a server `createLoader` could read the same
params, and `useTaskSearchParams()` wraps `useQueryStates` with
`history: "replace"` and returns intention-named setters (`setFilter`,
`openTask`, `closeTask`, `showNewTask`). Components call those rather than
touching `setParams`. Add new URL state there, not as another `useState`.
The create panel stays local — an unsaved form is not a shareable view.

## Subtasks

`Task.parentId` is a nullable self-reference. The API keeps the list **flat** —
a subtask is an ordinary row with `parentId` set, and no response nests
`subtasks` — so the tree is built here. `task-ui.ts` has the helpers:
`flattenTree()` (depth-first rows with `depth` and `childCount`, used by
`task-table.tsx` to indent; subtasks are collapsed unless their parent's id is
in the `expanded` set that `task-manager.tsx` owns, and a row whose parent was
filtered out renders as a root), `ancestorsOf()` (so opening a subtask expands
the rows above it),
`childrenOf()`, and `hasUnfinishedSubtasks()`, which mirrors the server's rule
that a task can only be done once its direct subtasks are. `StatusSelect` and
the detail panel's "Mark complete" use it to withhold "Done" up front; the
server still refuses with a 409 (`details.unfinishedSubtasks`) if it gets
through. Reopening a done subtask reopens its done ancestors server-side, and
the list refetch after the mutation shows that.

Subtasks are created only inline with their root, from the create panel. The
form state is the recursive `TaskFormValues` in `task-form-fields.tsx`, and
the form is wrapped in `FormProvider` so nested pieces use `useFormContext()`:

- `TaskFormFields` renders one task's fields at a `path` — `""` for the root,
  `"subtasks.0."`, `"subtasks.0.subtasks.2."`… — by appending the field name.
  The `as "title"` casts are how a dynamic path meets react-hook-form's typed
  names; the runtime path is what gets registered.
- `SubtaskList` is `useFieldArray` on `${path}subtasks`, one `SubtaskCard`
  per entry keyed by the array's `field.id` (never the index), and each card
  renders `TaskFormFields` for its path and then `SubtaskList` again — that
  recursion is the nesting, and depth is unbounded.

`toCreateInput()` in `task-manager.tsx` maps the tree to `CreateTaskInput`,
whose `subtasks` is the same shape recursively.

The detail panel (`task-detail-panel.tsx`) shows the tree around a task, after
the attribute grid and before the description: a **Parent task** section when
`parentId` is set, then **Subtasks**. Both render `TaskCard`
(`task-card.tsx`) — assignee avatar, title, assignee name, status badge —
which opens the task on click, so parent and children read as the same kind
of thing.

Skills and developers are read-only reference data from the API; the create
form offers the seeded skill pool and has no way to add to it.

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

## shadcn/ui

Components are generated into `components/ui/` and are **ours to edit** — they
are copied source, not a dependency. Add more with:

```sh
bunx --bun shadcn@latest add dialog table badge
```

Run it from this directory (`components.json` lives here, not at the repo
root). It builds on Radix primitives via the single `radix-ui` package, so
imports look like `import { Slot } from "radix-ui"`, not
`@radix-ui/react-slot`. `cn` comes from `cn`, shadcn's own compiled
clsx + tailwind-merge replacement, re-exported by `lib/utils.ts`.

Currently installed: `alert-dialog`, `avatar`, `badge`, `button`, `card`,
`checkbox`, `command`, `dialog`, `dropdown-menu`, `input`, `input-group`,
`label`, `popover`, `select`, `separator`, `sheet`, `skeleton`, `sonner`,
`switch`, `table`, `tabs`, `textarea`, `tooltip`.

Not installed on purpose: shadcn's `form` wrapper, which also wants `zod`.
`react-hook-form` is used on its own — see the dependency note above.

Two components need app-level wiring, and both are wired in
`app/layout.tsx` — you do not need to add them again per page:

- **`TooltipProvider`** wraps `{children}`. `Tooltip` is not self-wrapping and
  throws without a provider ancestor.
- **`Toaster`** (sonner) is rendered once, as a sibling of `{children}`.
  `toast()` calls do nothing without it.

Both are client components, so the root layout imports client code. That does
**not** make pages client components: `children` is rendered on the server and
passed through as already-rendered elements. Keep `"use client"` off pages —
see the note at the top of this file.

Two things about the theme were changed after `init` and must stay that way:

- **Light mode only.** `globals.css` has no dark token block and no `dark`
  custom variant, and `:root` sets `color-scheme: light`. Do not add `dark:`
  utilities. If a re-run of `init` or `add` writes a dark block or variant
  back, remove it.
- **`--font-sans` points at `--font-geist-sans`**, the variable
  `app/layout.tsx` gets from `next/font`. `init` emits
  `--font-sans: var(--font-sans)`, which resolves to nothing.

`shadcn` itself is a devDependency: `globals.css` imports
`shadcn/tailwind.css`, resolved at build time.

`components/ui/sonner.tsx` was edited to drop `next-themes`. Upstream reads
the theme from a `ThemeProvider` this app does not have, where `useTheme()`
just falls through to `"system"` anyway — which is what sonner now gets
directly. If
`add` regenerates the file, re-apply that edit rather than installing
`next-themes`.

## Talking to the backend

All requests go through `lib/api.ts`. It reads `NEXT_PUBLIC_API_URL`
(default `http://localhost:4000`) and sets `cache: "no-store"`, because task
data is mutable and must not be served from the build cache. A non-2xx response
throws `ApiError`, which carries the status and the server's `{ error, details }`
body — a 409 from the assignment rule lists `details.missingSkills`.
`describeError()` in `app/_hooks/use-task-mutations.ts` turns one into a
toast message.

`NEXT_PUBLIC_*` is inlined at build time, not read at runtime — changing the
API URL means a rebuild. Put it in `.env.local` (gitignored);
`.env.example` is the committed reference.

Server state is React Query, following TanStack's App Router recipe:

- `lib/queries.ts` holds `queryOptions()` for tasks, developers and skills. Both
  the server prefetch and the client hooks import from here so keys and
  fetchers can't drift.
- `app/page.tsx` (server) prefetches all three into a request-scoped client from
  `getQueryClient()` and wraps the client shell in `HydrationBoundary`. The
  first paint is server-rendered with real data, and `useQuery` on the client
  reads the hydrated cache rather than fetching again (`staleTime` is 60s).
  `prefetchQuery` swallows failures, so a down API means the client refetches
  and fails. Queries are `throwOnError` (`lib/query-client.ts`), so that
  failure propagates to `app/error.tsx`, the route's error boundary. It is
  deliberately generic — "Something went wrong" plus a "Try again" button
  that calls `queryClient.resetQueries()` before Next's `reset()` — and
  catches any render error, not only query failures. Components do not read
  `query.error` themselves.
- `app/_hooks/use-task-mutations.ts` owns the writes. `describeError()` also
  formats the two 409s: missing skills and unfinished subtasks. After creation a
  task changes in exactly two ways, mirrored by `TaskPatch` in `lib/types.ts`:
  `{ assigneeId }` goes to `PATCH /api/tasks/:id` and `{ status }` to
  `PATCH /api/tasks/:id/status`. Updates are optimistic against the tasks
  list, rolled back and toasted on error, and reconciled with the returned row.
  The detail panel shows everything else read-only.

## Conventions

- Path alias `@/*` maps to the app root (`@/lib/api`). Imports here omit file
  extensions — unlike the backend, which uses explicit `.ts`.
- Tailwind utilities only; no CSS modules or styled-components. Colors go
  through the `@theme inline` tokens in `globals.css`. The app is light mode
  only, so no `dark:` variants.
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
