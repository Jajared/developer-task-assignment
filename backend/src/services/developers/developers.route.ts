import { Router } from "express";

import * as controller from "./developers.controller.ts";

export const developersRouter = Router();

developersRouter.get("/", controller.getDevelopers);
developersRouter.get("/:id", controller.getDeveloper);
