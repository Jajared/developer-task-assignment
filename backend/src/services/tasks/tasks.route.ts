import { Router } from "express";

import * as controller from "./tasks.controller.ts";

export const tasksRouter = Router();

tasksRouter.get("/", controller.getTasks);
tasksRouter.get("/:id", controller.getTask);
tasksRouter.post("/", controller.createTask);
// The narrow route comes first: /:id/status must not be swallowed by /:id.
tasksRouter.patch("/:id/status", controller.updateTaskStatus);
tasksRouter.patch("/:id", controller.updateTask);
