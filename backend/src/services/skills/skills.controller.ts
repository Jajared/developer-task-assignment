import type { NextFunction, Request, Response } from "express";

import { log } from "../../lib/log.ts";
import * as skillService from "./skills.service.ts";
import * as skillValidator from "./skills.validator.ts";

/**
 * HTTP layer for skills: validates the request, calls the service, shapes the
 * response. Only the success path is written here — the service throws an
 * `HttpError` for a missing row, and the handler in app.ts sends it.
 */

async function getSkills(_req: Request, res: Response, next: NextFunction): Promise<void> {
  log("Get all skills");
  try {
    const skills = await skillService.listSkills();
    res.status(200).json({ skills });
  } catch (error) {
    next(error);
  }
}

async function getSkill(req: Request, res: Response, next: NextFunction): Promise<void> {
  log(`Get skill skillId[${req.params.id}]`);
  try {
    const { id } = skillValidator.validateSkillId(req.params);
    const skill = await skillService.findSkillById(id);
    res.status(200).json({ skill });
  } catch (error) {
    next(error);
  }
}

export { getSkills, getSkill };
