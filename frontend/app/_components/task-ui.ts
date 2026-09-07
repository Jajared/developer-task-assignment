/** Presentation helpers shared by the task list and its side panels. */
import { TaskPriority, TaskStatus, type Developer, type Skill } from "@/lib/types";
import type { UiTask } from "@/lib/mock-data";

export const STATUSES: TaskStatus[] = [TaskStatus.Todo, TaskStatus.InProgress, TaskStatus.Done];
export const PRIORITIES: TaskPriority[] = [TaskPriority.Low, TaskPriority.Medium, TaskPriority.High];

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

export const PRIORITY_LABEL: Record<TaskPriority, string> = {
  [TaskPriority.Low]: "Low",
  [TaskPriority.Medium]: "Medium",
  [TaskPriority.High]: "High",
};

export const PRIORITY_STYLE: Record<TaskPriority, string> = {
  [TaskPriority.Low]: "bg-zinc-100 text-zinc-700",
  [TaskPriority.Medium]: "bg-amber-100 text-amber-800",
  [TaskPriority.High]: "bg-red-100 text-red-800",
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

const AVATAR_PALETTE = ["bg-violet-500", "bg-orange-500", "bg-teal-500", "bg-pink-500", "bg-blue-500", "bg-emerald-500"];

export function avatarStyle(developers: Developer[], developerId: string): string {
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
  return new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function hasAllSkills(dev: Developer, required: Skill[]): boolean {
  return required.every((s) => dev.skills.some((d) => d.id === s.id));
}

export function missingSkills(dev: Developer, required: Skill[]): Skill[] {
  return required.filter((s) => !dev.skills.some((d) => d.id === s.id));
}

export function eligibleDevelopers(developers: Developer[], required: Skill[]): Developer[] {
  return developers.filter((d) => hasAllSkills(d, required));
}

/** Count of a developer's tasks that are not done. */
export function openLoad(tasks: UiTask[], developerId: string): number {
  return tasks.filter((t) => t.assigneeId === developerId && t.status !== TaskStatus.Done).length;
}
