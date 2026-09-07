import type { NextFunction, Request, Response } from "express";

import * as developerService from "./developers.service.ts";
import * as developerValidator from "./developers.validator.ts";

/**
 * HTTP layer for developers: validates the request, calls the service, shapes
 * the response. Only the success path is written here — the service throws an
 * `HttpError` for a missing row, and the handler in app.ts sends it.
 */

async function getDevelopers(req: Request, res: Response, next: NextFunction): Promise<void> {
  req.log.info("Get all developers");
  try {
    const developers = await developerService.listDevelopers();
    res.status(200).json({ developers });
  } catch (error) {
    next(error);
  }
}

async function getDeveloper(req: Request, res: Response, next: NextFunction): Promise<void> {
  req.log.info("Get developer", { developerId: req.params.id });
  try {
    const { id } = developerValidator.validateDeveloperId(req.params);
    const developer = await developerService.findDeveloperById(id);
    res.status(200).json({ developer });
  } catch (error) {
    next(error);
  }
}

export { getDevelopers, getDeveloper };
