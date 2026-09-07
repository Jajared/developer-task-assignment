import { AsyncLocalStorage } from "node:async_hooks";
import { createLogger, format, transports, type Logger } from "winston";

import { env } from "./env.ts";

/**
 * The process-wide Winston logger. Import `logger` from anywhere that has no
 * request in hand (boot, shutdown, background work). Inside a handler use
 * `req.log`, the child logger `requestLogger` attaches — it carries the
 * request id so every line from one request can be grepped together. Services
 * and libs have no `req`, so they call `getLogger()`, which returns the same
 * child through AsyncLocalStorage while a request is in flight and falls back
 * to the base logger otherwise (seed script, tests, boot).
 *
 * Levels follow npm: error > warn > info > http > debug. `LOG_LEVEL` picks the
 * threshold; the default is `debug` in development and `http` in production,
 * so production records every request but nothing that echoes user input —
 * request bodies and LLM replies are `debug`, off unless someone turns it up.
 *
 * Every environment prints the same coloured, human-readable line per entry;
 * there is no JSON mode.
 */

/** Meta keys that are already rendered elsewhere in the line. */
const RENDERED_KEYS = new Set(["level", "message", "timestamp", "stack", "requestId", "service"]);

const lineFormat = format.combine(
  format.timestamp({ format: "HH:mm:ss.SSS" }),
  format.errors({ stack: true }),
  format.colorize(),
  format.printf((info) => {
    const { timestamp, level, message, stack, requestId } = info;
    const meta = Object.fromEntries(Object.entries(info).filter(([key]) => !RENDERED_KEYS.has(key)));
    const parts = [
      `${timestamp} ${level}`,
      requestId ? `[${String(requestId).slice(0, 8)}]` : null,
      String(message),
      Object.keys(meta).length > 0 ? JSON.stringify(meta) : null,
    ].filter(Boolean);
    return parts.join(" ") + (stack ? `\n${stack}` : "");
  }),
);

export const logger: Logger = createLogger({
  level: env.logLevel,
  format: lineFormat,
  defaultMeta: { service: "backend" },
  transports: [new transports.Console({ stderrLevels: ["error"] })],
  // Tests assert on responses, not on log output — keep the terminal readable.
  silent: env.nodeEnv === "test" && !process.env.LOG_LEVEL,
});

/** Holds the current request's child logger for the duration of its async chain. */
export const loggerStorage = new AsyncLocalStorage<Logger>();

/** The request-scoped logger when inside a request, else the base logger. */
export function getLogger(): Logger {
  return loggerStorage.getStore() ?? logger;
}

/**
 * Turn an unknown thrown value into plain fields Winston can serialise.
 * `format.errors` only unwraps an Error passed as the message itself, so
 * anything logged under a key (`{ error }`) goes through here first.
 */
export function describeError(error: unknown): { name: string; message: string; stack?: string } {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "NonError", message: String(error) };
}
