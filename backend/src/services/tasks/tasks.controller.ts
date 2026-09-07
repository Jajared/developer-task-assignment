import type { NextFunction, Request, Response } from "express";

import * as taskService from "./tasks.service.ts";
import * as taskValidator from "./tasks.validator.ts";

/**
 * HTTP layer for tasks: validates the request, calls the service, shapes the
 * response. Only the success path is written here — the service throws an
 * an `http-errors` error for anything it can't do, `next` forwards it, and the handler in
 * app.ts sends it at the status the error carries.
 */

async function getTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  req.log.info("Get all tasks");
  try {
    const tasks = await taskService.listTasks();
    res.status(200).json({ tasks });
  } catch (error) {
    next(error);
  }
}

async function getTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  req.log.info("Get task", { taskId: req.params.id });
  try {
    const { id } = taskValidator.validateTaskId(req.params);
    const task = await taskService.findTaskById(id);
    res.status(200).json({ task });
  } catch (error) {
    next(error);
  }
}

async function createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  req.log.info("Create task");
  req.log.debug("Create task body", { body: req.body });
  try {
    const payload = taskValidator.validateCreateTask(req.body);
    const task = await taskService.createTask(payload);
    res.status(201).json({ task });
  } catch (error) {
    next(error);
  }
}

async function updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  req.log.info("Update task", { taskId: req.params.id });
  req.log.debug("Update task body", { body: req.body });
  try {
    const { id } = taskValidator.validateTaskId(req.params);
    const payload = taskValidator.validateUpdateTask(req.body);
    const task = await taskService.updateTask(id, payload);
    res.status(200).json({ task });
  } catch (error) {
    next(error);
  }
}

async function updateTaskStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  req.log.info("Update task status", { taskId: req.params.id });
  req.log.debug("Update task status body", { body: req.body });
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
