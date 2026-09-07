import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import cors from "cors";

import { env } from "./env.ts";
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

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  };
  app.use(onError);

  return app;
}
