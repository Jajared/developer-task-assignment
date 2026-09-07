import type { NextFunction, Request, Response } from "express";

import { log, logVerbose } from "@/lib/log.ts";
import * as taskService from "./tasks.service.ts";
import * as taskValidator from "./tasks.validator.ts";

/**
 * HTTP layer for tasks: validates the request, calls the service, shapes the
 * response. Only the success path is written here — the service throws an
 * `HttpError` for anything it can't do, `next` forwards it, and the handler in
 * app.ts sends it at the status the error carries.
 */

async function getTasks(_req: Request, res: Response, next: NextFunction): Promise<void> {
  log("Get all tasks");
  try {
    const tasks = await taskService.listTasks();
    res.status(200).json({ tasks });
  } catch (error) {
    next(error);
  }
}

async function getTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  log(`Get task taskId[${req.params.id}]`);
  try {
    const { id } = taskValidator.validateTaskId(req.params);
    const task = await taskService.findTaskById(id);
    res.status(200).json({ task });
  } catch (error) {
    next(error);
  }
}

async function createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  logVerbose("Create task", req.body);
  try {
    const payload = taskValidator.validateCreateTask(req.body);
    const task = await taskService.createTask(payload);
    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
}

async function updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  logVerbose(`Update task taskId[${req.params.id}]`, req.body);
  try {
    const { id } = taskValidator.validateTaskId(req.params);
    const payload = taskValidator.validateUpdateTask(req.body);
    const task = await taskService.updateTask(id, payload);
    res.status(200).json({ task });
  } catch (error) {
    next(error);
  }
}

/** Status-only update, so a board drag can't smuggle in an assignee change. */
async function updateTaskStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  logVerbose(`Update task status taskId[${req.params.id}]`, req.body);
  try {
    const { id } = taskValidator.validateTaskId(req.params);
    const payload = taskValidator.validateUpdateTaskStatus(req.body);
    const task = await taskService.updateTaskStatus(id, payload);
    res.status(200).json({ task });
  } catch (error) {
    next(error);
  }
}

export { getTasks, getTask, createTask, updateTask, updateTaskStatus };
