# frontend

The task-assignment UI. Next.js 16 App Router, React 19, Tailwind 4,
shadcn/ui, TanStack Query, react-hook-form and nuqs. Single page: a filterable
task list with a detail side panel and a create panel.

## Running

The backend must be up (see the root README). Then, from the repo root:

```sh
bun dev:frontend        # next dev on :3000
```

Or from this directory: `bun run dev`, `bun run build`, `bun run start`,
`bun run lint`, `bun run typecheck`.

## Configuration

`frontend/.env.local` (copy from `.env.example`):

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:4000` | Backend base URL. Inlined at build time — changing it requires a rebuild. |

## What the page does

- **List** every task as a tree. Subtasks are collapsed under their parent
  and expand on click. A table at `md` and above, stacked cards below.
- **Filter** by status or "unassigned" via `?filter=`. The open task is
  `?task=<id>`, so any view can be linked or reloaded.
- **Change assignee or status inline.** Developers who lack a required skill
  are listed but disabled (the create form hides them instead). "Done" is
  withheld while a subtask is still open.
  Updates are optimistic and roll back with a toast if the server refuses.
- **Detail panel** shows the task, its parent, and its direct subtasks, each
  a link that opens that task in the same panel.
- **Create panel** builds a task with nested subtasks in one form. Required
  skills are optional at every level; a task sent without them has them
  inferred server-side, and the success toast names what was inferred. The
  assignee picker is disabled until skills are chosen.

## Structure

```
app/                App Router: layout, page, error boundary, providers
  _components/      components private to the page
  _hooks/           React Query mutations and nuqs URL state
components/ui/      shadcn/ui components
lib/                API client, query definitions, constants
types/              the API contract, hand-maintained; import from `@/types`
```

## Types

`types/` is a hand-maintained copy of the backend's API contract. There is no
shared package and no check that the two agree. When the Prisma schema
changes, update the matching file here and verify against a real response.

## shadcn/ui

Components are copied into `components/ui/` and are editable. Add more from
this directory:

```sh
bunx --bun shadcn@latest add <component>
```

The theme is light-only; `globals.css` has no dark tokens. `sonner.tsx` was
edited to drop `next-themes`. See `CLAUDE.md` for the full list of post-init
edits to preserve.

## Tests

```sh
bun test            # from this directory; or `bun run test` from the root
```

One pure suite, `app/_components/task-ui.test.ts`, covering the helpers that
turn the flat task list into a tree and mirror the server's rules
(`flattenTree`, `childrenOf`, `ancestorsOf`, `hasUnfinishedSubtasks`, skill
matching). No DOM, no network. Components are covered by `bun run lint` and
`bun run typecheck` only.
