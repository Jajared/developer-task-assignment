import type { NextFunction, Request, Response } from "express";
import type { Logger } from "winston";

import { logger, loggerStorage } from "./log.ts";

declare global {
  namespace Express {
    interface Request {
      /** Unique per request; echoed back as the `X-Request-Id` header. */
      id: string;
      /** Child of the app logger with `requestId` already attached. */
      log: Logger;
    }
  }
}

const HEADER = "x-request-id";

/**
 * First middleware in the chain. Gives the request an id (honouring one an
 * upstream proxy already set), hangs a child logger on `req.log` (and in
 * `loggerStorage`, so services reach it through `getLogger()`), and writes
 * one access line when the response finishes: method, path, status and
 * duration. 5xx lines are `error`, 4xx are `warn`, everything else `http`, so
 * a level filter on its own separates "traffic" from "something to look at".
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get(HEADER);
  req.id = incoming && incoming.length <= 128 ? incoming : crypto.randomUUID();
  req.log = logger.child({ requestId: req.id });
  res.setHeader("X-Request-Id", req.id);

  const startedAt = performance.now();

  res.on("finish", () => {
    const durationMs = Math.round(performance.now() - startedAt);
    const level = res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "http";
    req.log.log(level, `${req.method} ${req.originalUrl} ${res.statusCode}`, {
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs,
      contentLength: res.get("content-length") ?? null,
    });
  });

  loggerStorage.run(req.log, next);
}
