import { z } from "zod";

import { parseOrThrow } from "@/lib/validate.ts";

/** Route params for the skill routes. */
const skillIdSchema = z.object({
  id: z.string().uuid("Skill id must be a uuid"),
});

export type TSkillId = z.infer<typeof skillIdSchema>;

export const validateSkillId = (payload: unknown): TSkillId =>
  parseOrThrow(skillIdSchema, payload, "Invalid skill id.");
