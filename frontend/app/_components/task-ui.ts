/** Presentation helpers shared by the task list and its side panels. */
import {
  TaskStatus,
  type Developer,
  type Skill,
  type Task,
} from "@/lib/types";

export const STATUSES: TaskStatus[] = [
  TaskStatus.Todo,
  TaskStatus.InProgress,
  TaskStatus.Done,
];

export const STATUS_LABEL: Record<TaskStatus, string> = {
  [TaskStatus.Todo]: "To do",
  [TaskStatus.InProgress]: "In progress",
  [TaskStatus.Done]: "Done",
};

export const STATUS_STYLE: Record<TaskStatus, string> = {
  [TaskStatus.Todo]: "bg-zinc-100 text-zinc-800",
  [TaskStatus.InProgress]: "bg-blue-100 text-blue-800",
  [TaskStatus.Done]: "bg-emerald-100 text-emerald-800",
};


const SKILL_PALETTE = [
  "bg-violet-100 text-violet-800",
  "bg-blue-100 text-blue-800",
  "bg-emerald-100 text-emerald-800",
  "bg-orange-100 text-orange-800",
  "bg-pink-100 text-pink-800",
  "bg-teal-100 text-teal-800",
  "bg-yellow-100 text-yellow-800",
  "bg-zinc-100 text-zinc-700",
  "bg-fuchsia-100 text-fuchsia-800",
];

/** Stable colour per skill name, so the same skill looks the same everywhere. */
export function skillStyle(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 9973;
  return SKILL_PALETTE[h % SKILL_PALETTE.length];
}

const AVATAR_PALETTE = [
  "bg-violet-500",
  "bg-orange-500",
  "bg-teal-500",
  "bg-pink-500",
  "bg-blue-500",
  "bg-emerald-500",
];

export function avatarStyle(
  developers: Developer[],
  developerId: string,
): string {
  const idx = developers.findIndex((d) => d.id === developerId);
  return AVATAR_PALETTE[(idx < 0 ? 0 : idx) % AVATAR_PALETTE.length];
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "No date";
  return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function hasAllSkills(dev: Developer, required: Skill[]): boolean {
  return required.every((s) => dev.skills.some((d) => d.id === s.id));
}

export function missingSkills(dev: Developer, required: Skill[]): Skill[] {
  return required.filter((s) => !dev.skills.some((d) => d.id === s.id));
}

export function eligibleDevelopers(
  developers: Developer[],
  required: Skill[],
): Developer[] {
  return developers.filter((d) => hasAllSkills(d, required));
}

// ---- Subtasks. The API returns a flat list where each row carries `parentId`;
// these helpers turn that into a tree where the UI needs one.

/** Direct subtasks of `parentId`, in list (newest-first) order. */
export function childrenOf(tasks: Task[], parentId: string): Task[] {
  return tasks.filter((t) => t.parentId === parentId);
}

/**
 * True while any direct subtask is not done — the same rule the server
 * applies before it lets a task become done. Direct children suffice: a done
 * child already vouches for its own subtree.
 */
export function hasUnfinishedSubtasks(task: Task, tasks: Task[]): boolean {
  return childrenOf(tasks, task.id).some((t) => t.status !== TaskStatus.Done);
}

export type TreeRow = {
  task: Task;
  depth: number;
  /** Direct subtasks present in the list; 0 for a leaf. */
  childCount: number;
};

/**
 * Depth-first order for rendering a flat list as a tree. A task whose parent
 * is not in `tasks` is treated as a root, so a filtered list still shows a
 * child whose parent the filter removed. Subtasks of a task that is not in
 * `expanded` are left out — the row still reports its `childCount`, so the
 * table can offer to expand it.
 */
export function flattenTree(tasks: Task[], expanded: ReadonlySet<string>): TreeRow[] {
  const present = new Set(tasks.map((t) => t.id));
  const byParent = new Map<string | null, Task[]>();
  for (const t of tasks) {
    const key = t.parentId && present.has(t.parentId) ? t.parentId : null;
    const list = byParent.get(key);
    if (list) list.push(t);
    else byParent.set(key, [t]);
  }

  const rows: TreeRow[] = [];
  const visit = (parentId: string | null, depth: number) => {
    for (const task of byParent.get(parentId) ?? []) {
      const children = byParent.get(task.id) ?? [];
      rows.push({ task, depth, childCount: children.length });
      if (expanded.has(task.id)) visit(task.id, depth + 1);
    }
  };
  visit(null, 0);
  return rows;
}

/** Ids of every task above `id`, nearest first. Used to reveal a subtask in the list. */
export function ancestorsOf(tasks: Task[], id: string): string[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const out: string[] = [];
  let parentId = byId.get(id)?.parentId ?? null;
  while (parentId && byId.has(parentId) && !out.includes(parentId)) {
    out.push(parentId);
    parentId = byId.get(parentId)?.parentId ?? null;
  }
  return out;
}
