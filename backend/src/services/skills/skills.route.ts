import { Router } from "express";

import * as controller from "./skills.controller.ts";

export const skillsRouter = Router();

skillsRouter.get("/", controller.getSkills);
skillsRouter.get("/:id", controller.getSkill);
