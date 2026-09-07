/**
 * The API contract as the frontend sees it. These mirror the backend's
 * `tasks.types.ts`, which is derived from the Prisma schema — keep them in
 * step when the schema changes.
 */

export const TaskStatus = {
  Todo: "todo",
  InProgress: "in_progress",
  Done: "done",
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskPriority = {
  Low: "low",
  Medium: "medium",
  High: "high",
} as const;

export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** Developer the task is assigned to, or null while unassigned. */
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string | null;
};

export type UpdateTaskInput = Partial<CreateTaskInput>;

// Response envelopes
export type TaskListResponse = { tasks: Task[] };
export type TaskResponse = { task: Task };
export type ErrorResponse = { error: string; details?: unknown };
