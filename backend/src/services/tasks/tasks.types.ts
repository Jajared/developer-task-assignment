import type { TaskPriority, TaskStatus } from "../../generated/prisma/enums.ts";
import type { TaskModel } from "../../generated/prisma/models.ts";

/** A task row exactly as Prisma returns it. */
export type TaskRow = TaskModel;

/**
 * The task as the API sends it: the Prisma row with `Date` columns serialized
 * to ISO strings. This is the shape the frontend consumes.
 */
export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
};

// Response envelopes
export type TaskListResponse = { tasks: Task[] };
export type TaskResponse = { task: Task };
export type ErrorResponse = { error: string; details?: unknown };
