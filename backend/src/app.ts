import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import cors from "cors";

import { env } from "./env.ts";
import { HttpError } from "./lib/http-error.ts";
import { developersRouter } from "./services/developers/developers.route.ts";
import { skillsRouter } from "./services/skills/skills.route.ts";
import { tasksRouter } from "./services/tasks/tasks.route.ts";

/**
 * Builds the Express app without binding a port, so tests can drive it directly.
 * Mount each new service's router here.
 */
export function createApp() {
  const app = express();

  app.use(cors({ origin: env.corsOrigins }));
  app.use(express.json());

  app.get("/health", (_req, res: Response<{ status: "ok"; uptime: number }>) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.use("/api/tasks", tasksRouter);
  app.use("/api/developers", developersRouter);
  app.use("/api/skills", skillsRouter);

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    // A thrown HttpError is a decision, not a fault — send it as intended.
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message, details: err.details });
      return;
    }

    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(onError);

  return app;
}
