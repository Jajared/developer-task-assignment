/**
 * A capability such as "Frontend" or "Backend". Shared reference data:
 * developers hold skills, tasks require them. Mirrors the `Skill` model in
 * `backend/db/schema.prisma`; timestamps arrive as ISO strings.
 */
export type Skill = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

// Response envelopes
export type SkillListResponse = { skills: Skill[] };
export type SkillResponse = { skill: Skill };
