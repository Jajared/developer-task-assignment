import { z } from "zod";

import { TaskPriority, TaskStatus } from "@/generated/prisma/enums.ts";
import { parseOrThrow } from "@/lib/validate.ts";

/**
 * Request shapes for the task routes. The allowed values come from the Prisma
 * schema's enums, so the API rejects anything the database column would.
 *
 * Relations are written by id: `assigneeId` names a developer, and
 * `requiredSkillIds` (create only) is the task's required-skill set. Whether
 * that pairing is *allowed* is a rule, not a shape — tasks.service.ts owns it.
 */

const createTaskSchema = z.object({
  title: z
    .string({ message: "Title is required" })
    .trim()
    .min(1, "Title is required")
    .max(200, "Title must be at most 200 characters"),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be at most 2000 characters")
    .nullish(),
  status: z
    .nativeEnum(TaskStatus, { message: "Status must be todo, in_progress or done" })
    .default(TaskStatus.todo),
  priority: z
    .nativeEnum(TaskPriority, { message: "Priority must be low, medium or high" })
    .default(TaskPriority.medium),
  assigneeId: z.string().uuid("Assignee must be a developer id").nullish(),
  requiredSkillIds: z
    .array(z.string().uuid("Required skills must be skill ids"))
    .default([]),
  // A calendar date, sent as YYYY-MM-DD. Stored in a DATE column, so it is
  // parsed at UTC midnight and comes back the same way.
  dueDate: z
    .string()
    .date("Due date must be YYYY-MM-DD")
    .nullish()
    .transform((value) => (value == null ? value : new Date(`${value}T00:00:00.000Z`))),
});

/**
 * Body for `PATCH /api/tasks/:id`. Assignment is the only thing that route
 * changes: null unassigns. Everything else about a task is fixed at creation,
 * and status has its own route.
 */
const updateTaskSchema = z.object({
  assigneeId: z
    .string({ message: "assigneeId is required (null to unassign)" })
    .uuid("Assignee must be a developer id")
    .nullable(),
});

/** Body for the dedicated status route, where only the status may change. */
const updateTaskStatusSchema = z.object({
  status: z.nativeEnum(TaskStatus, { message: "Status must be todo, in_progress or done" }),
});

export type TCreateTask = z.infer<typeof createTaskSchema>;
export type TUpdateTask = z.infer<typeof updateTaskSchema>;
export type TUpdateTaskStatus = z.infer<typeof updateTaskStatusSchema>;

/** Route params for the routes with an `:id` segment. */
const taskIdSchema = z.object({
  id: z.string().uuid("Task id must be a uuid"),
});

export type TTaskId = z.infer<typeof taskIdSchema>;

export const validateTaskId = (payload: unknown): TTaskId =>
  parseOrThrow(taskIdSchema, payload, "Invalid task id.");

export const validateCreateTask = (payload: unknown): TCreateTask =>
  parseOrThrow(createTaskSchema, payload, "Invalid payload to create task.");

export const validateUpdateTask = (payload: unknown): TUpdateTask =>
  parseOrThrow(updateTaskSchema, payload, "Invalid payload to update task.");

export const validateUpdateTaskStatus = (payload: unknown): TUpdateTaskStatus =>
  parseOrThrow(updateTaskStatusSchema, payload, "Invalid payload to update task status.");
