import { z } from "zod";

import { parseOrThrow } from "../../lib/validate.ts";

/** Route params for the developer routes. */
const developerIdSchema = z.object({
  id: z.string().uuid("Developer id must be a uuid"),
});

export type TDeveloperId = z.infer<typeof developerIdSchema>;

export const validateDeveloperId = (payload: unknown): TDeveloperId =>
  parseOrThrow(developerIdSchema, payload, "Invalid developer id.");
