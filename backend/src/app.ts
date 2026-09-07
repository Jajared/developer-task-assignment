import express, { type ErrorRequestHandler, type Express, type Request, type Response } from "express";
import cors from "cors";
import { isHttpError } from "http-errors";

import { env } from "@/lib/env.ts";
import { describeError } from "@/lib/log.ts";
import { requestLogger } from "@/lib/request-logger.ts";
import { developersRouter } from "@/services/developers/developers.route.ts";
import { skillsRouter } from "@/services/skills/skills.route.ts";
import { tasksRouter } from "@/services/tasks/tasks.route.ts";

export function createApp(): Express {
  const app = express();

  app.use(requestLogger);
  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json());

  app.get("/health", (_req, res: Response<{ status: "ok"; uptime: number }>) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  // Mount each new service's router here.
  app.use("/api/tasks", tasksRouter);
  app.use("/api/developers", developersRouter);
  app.use("/api/skills", skillsRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  const onError: ErrorRequestHandler = (err, req, res, _next) => {
    if (isHttpError(err) && err.expose) {
      req.log.debug(`Request refused: ${err.message}`, { status: err.status, details: err.details });
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }

    req.log.error("Unhandled error", { error: describeError(err) });
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(onError);

  return app;
}
