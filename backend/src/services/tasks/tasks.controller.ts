import type { RequestHandler } from "express";

import { taskService } from "./tasks.service.ts";

/** Routes with an `:id` segment. */
type IdParams = { id: string };

/**
 * HTTP layer for tasks: reads the request, calls the service, shapes the
 * response. Bodies arriving here are already validated by tasks.validator.ts.
 *
 * Express 5 forwards a rejected promise to the error handler on its own, so
 * these handlers can throw and let app.ts turn it into a 500.
 */

export const listTasks: RequestHandler = async (_req, res) => {
  res.json({ tasks: await taskService.list() });
};

export const getTask: RequestHandler<IdParams> = async (req, res) => {
  const task = await taskService.findById(req.params.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json({ task });
};

export const createTask: RequestHandler = async (req, res) => {
  res.status(201).json({ task: await taskService.create(req.body) });
};

export const updateTask: RequestHandler<IdParams> = async (req, res) => {
  const task = await taskService.update(req.params.id, req.body);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json({ task });
};

export const deleteTask: RequestHandler<IdParams> = async (req, res) => {
  if (!(await taskService.remove(req.params.id))) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.status(204).end();
};
