import { prisma } from "@/db/prisma.ts";
import { HttpError } from "@/lib/http-error.ts";

/**
 * Skills are read-only over the API — they're reference data, created by the
 * seed and referenced by developers and tasks.
 *
 * A missing skill throws an `HttpError` carrying its 404, so the controller
 * only writes the success path.
 *
 * The controller imports this module as a namespace (`* as skillService`), so
 * these read as `skillService.listSkills()` at the call site.
 */

export async function listSkills() {
  return prisma.skill.findMany({ orderBy: { name: "asc" } });
}

export async function findSkillById(id: string) {
  const row = await prisma.skill.findUnique({ where: { id } });
  if (!row) throw new HttpError({ message: "Skill not found", status: 404 });

  return row;
}
