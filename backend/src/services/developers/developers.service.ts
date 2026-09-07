import { prisma } from "@/db/prisma.ts";
import { HttpError } from "@/lib/http-error.ts";

/**
 * Developers are read-only over the API — they're created by the seed. Tasks
 * reference them, and `tasks.service.ts` reads their skills to decide whether
 * an assignment is allowed.
 *
 * A missing developer throws an `HttpError` carrying its 404, so the
 * controller only writes the success path.
 *
 * The controller imports this module as a namespace (`* as developerService`).
 */

export async function listDevelopers() {
  return prisma.developer.findMany({
    include: { skills: { orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });
}

export async function findDeveloperById(id: string) {
  const row = await prisma.developer.findUnique({
    where: { id },
    include: { skills: { orderBy: { name: "asc" } } },
  });
  if (!row) throw new HttpError({ message: "Developer not found", status: 404 });

  return row;
}
