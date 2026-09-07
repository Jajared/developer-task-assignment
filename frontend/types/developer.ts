import type { Skill } from "./skill";

/** Mirrors the `Developer` model in `backend/db/schema.prisma`, with its skills included. */
export type Developer = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Skills the developer holds — this is what makes them eligible for a task. */
  skills: Skill[];
};

// Response envelopes
export type DeveloperListResponse = { developers: Developer[] };
export type DeveloperResponse = { developer: Developer };
