import { Router } from "express";

import * as controller from "./tasks.controller.ts";
import { validateCreateTask, validateUpdateTask } from "./tasks.validator.ts";

export const tasksRouter = Router();

tasksRouter.get("/", controller.listTasks);
tasksRouter.get("/:id", controller.getTask);
tasksRouter.post("/", validateCreateTask, controller.createTask);
tasksRouter.patch("/:id", validateUpdateTask, controller.updateTask);
tasksRouter.delete("/:id", controller.deleteTask);
