import express, { type ErrorRequestHandler, type Request, type Response } from "express";
import cors from "cors";

import { prisma } from "@/db/prisma.ts";
import { env } from "@/lib/env.ts";
import { HttpError } from "@/lib/http-error.ts";
import { developersRouter } from "@/services/developers/developers.route.ts";
import { skillsRouter } from "@/services/skills/skills.route.ts";
import { tasksRouter } from "@/services/tasks/tasks.route.ts";

const app = express();

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

const server = app.listen(env.port, () => {
  console.log(`backend listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

// Close the HTTP server and the connection pool so containers stop cleanly.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  });
}
