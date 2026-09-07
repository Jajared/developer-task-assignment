/**
 * In-memory fixtures for the task manager UI. The backend is not wired up yet,
 * so the page seeds its client state from here. Shapes follow `lib/types.ts`;
 * `dueDate` is a UI-only field the API does not have yet.
 */
import { TaskPriority, TaskStatus, type Developer, type Skill, type Task } from "./types";

const STAMP = "2026-08-20T09:00:00.000Z";

export type UiTask = Omit<Task, "assignee"> & {
  /** ISO date (YYYY-MM-DD) or null. Not part of the API contract yet. */
  dueDate: string | null;
};

function skill(id: string, name: string): Skill {
  return { id, name, createdAt: STAMP, updatedAt: STAMP };
}

export const SKILLS: Skill[] = [
  skill("s-react", "React"),
  skill("s-ts", "TypeScript"),
  skill("s-css", "CSS"),
  skill("s-node", "Node.js"),
  skill("s-pg", "PostgreSQL"),
  skill("s-py", "Python"),
  skill("s-data", "Data"),
  skill("s-devops", "DevOps"),
  skill("s-sec", "Security"),
];

const byId = Object.fromEntries(SKILLS.map((s) => [s.id, s])) as Record<string, Skill>;
const pick = (...ids: string[]) => ids.map((id) => byId[id]);

export const DEVELOPERS: Developer[] = [
  { id: "d1", name: "Aisha Rahman", createdAt: STAMP, updatedAt: STAMP, skills: pick("s-react", "s-ts", "s-css") },
  { id: "d2", name: "Marcus Lee", createdAt: STAMP, updatedAt: STAMP, skills: pick("s-node", "s-pg", "s-ts") },
  { id: "d3", name: "Priya Nair", createdAt: STAMP, updatedAt: STAMP, skills: pick("s-py", "s-data", "s-pg") },
  { id: "d4", name: "Tom Okafor", createdAt: STAMP, updatedAt: STAMP, skills: pick("s-devops", "s-node", "s-sec") },
];

function task(
  id: string,
  title: string,
  description: string,
  skillIds: string[],
  assigneeId: string | null,
  status: TaskStatus,
  priority: TaskPriority,
  dueDate: string,
  created: string,
): UiTask {
  const createdAt = `${created}T09:00:00.000Z`;
  return {
    id,
    title,
    description,
    status,
    priority,
    assigneeId,
    createdAt,
    updatedAt: createdAt,
    requiredSkills: pick(...skillIds),
    dueDate,
  };
}

export const TASKS: UiTask[] = [
  task("t1", "Migrate auth service to OAuth 2.1", "Replace legacy session tokens across web and mobile clients.", ["s-node", "s-sec"], "d4", TaskStatus.InProgress, TaskPriority.High, "2026-09-12", "2026-08-28"),
  task("t2", "Redesign task list filters", "Chip-based filtering with saved views.", ["s-react", "s-css"], "d1", TaskStatus.InProgress, TaskPriority.Medium, "2026-09-10", "2026-08-30"),
  task("t3", "Nightly usage report pipeline", "Aggregate events into a warehouse table and email a summary.", ["s-py", "s-data"], null, TaskStatus.Todo, TaskPriority.Medium, "2026-09-18", "2026-09-01"),
  task("t4", "Index slow queries on tasks table", "p95 above 800ms on the list endpoint.", ["s-pg"], "d2", TaskStatus.Done, TaskPriority.High, "2026-09-04", "2026-08-25"),
  task("t5", "Type the public API client", "Generate TypeScript types from the OpenAPI spec.", ["s-ts", "s-node"], null, TaskStatus.Todo, TaskPriority.Low, "2026-09-25", "2026-09-03"),
  task("t6", "Container hardening for CI runners", "Rootless builds and pinned base images.", ["s-devops", "s-sec"], null, TaskStatus.Todo, TaskPriority.High, "2026-09-15", "2026-09-05"),
];
