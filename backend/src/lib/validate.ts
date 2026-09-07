import type { z, ZodTypeAny } from "zod";

import { UnprocessableEntity } from "http-errors";

/**
 * Parses a payload against a schema or throws. One place turns a `ZodError`
 * into an `http-errors` 422, so every validator stays a single expression and the
 * field errors always reach the client the same way.
 *
 * 422, not 400 — the body parsed as JSON, it just failed the schema.
 */
export function parseOrThrow<TSchema extends ZodTypeAny>(
  schema: TSchema,
  payload: unknown,
  message: string,
): z.infer<TSchema> {
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    throw Object.assign(new UnprocessableEntity(message), {
      details: parsed.error.flatten(),
      cause: parsed.error,
    });
  }

  return parsed.data;
}
