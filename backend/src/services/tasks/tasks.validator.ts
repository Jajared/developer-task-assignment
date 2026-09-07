import type { RequestHandler } from "express";
import { z, type ZodType } from "zod";

import { TaskPriority, TaskStatus } from "../../generated/prisma/enums.ts";

/**
 * Request shapes for the task routes, and the middleware that enforces them.
 * The allowed values come from the Prisma schema's enums, so the API rejects
 * anything the database column would.
 */

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullish(),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.todo),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.medium),
  assignee: z.string().min(1).max(100).nullish(),
});

/** Every field optional, for PATCH. */
export const updateTaskSchema = createTaskSchema.partial();

export type CreateTaskBody = z.output<typeof createTaskSchema>;
export type UpdateTaskBody = z.output<typeof updateTaskSchema>;

/**
 * Replaces `req.body` with the parsed result, so the controller receives
 * defaults applied and types narrowed.
 */
function validateBody(schema: ZodType): RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);

    if (!parsed.success) {
      res.status(422).json({ error: "Validation failed", details: parsed.error.flatten() });
      return;
    }

    req.body = parsed.data;
    next();
  };
}

export const validateCreateTask = validateBody(createTaskSchema);

export const validateUpdateTask = validateBody(updateTaskSchema);
