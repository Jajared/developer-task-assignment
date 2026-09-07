import { env } from "./env.ts";

/** One line per request, so a handler's entry is visible in the server log. */
export function log(message: string): void {
  console.log(`[api] ${message}`);
}

/**
 * Same, plus the payload that came with the request. Silenced in production:
 * request bodies are the one place user data reliably shows up in logs.
 */
export function logVerbose(message: string, context?: unknown): void {
  if (env.nodeEnv === "production") return;
  console.log(`[api] ${message}`, context ?? "");
}
