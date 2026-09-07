import { prisma } from "../../db/prisma.ts";
import { HttpError } from "../../lib/http-error.ts";
import type { TaskStatus } from "../../generated/prisma/enums.ts";
import type { TCreateTask, TUpdateTask, TUpdateTaskStatus } from "./tasks.validator.ts";

/** No task with that id — the same 404 wherever a task is looked up. */
function taskNotFound(): HttpError {
  return new HttpError({ message: "Task not found", status: 404 });
}

/**
 * The assignment rule: a task may only be held by a developer who has every
 * skill the task requires. Nothing in the database enforces this — the join
 * tables are independent — so it's checked here, against the state the task
 * will have *after* the write, not the state it has now.
 *
 * Throws if the pairing isn't allowed: 409 when the developer is real but
 * under-skilled (the request was fine, the data refused it), 422 when the body
 * names a row that doesn't exist.
 */
async function assertAssignable(
  assigneeId: string | null,
  requiredSkillIds: string[],
): Promise<void> {
  if (requiredSkillIds.length > 0) {
    // Connecting a skill that doesn't exist would fail deep inside Prisma with
    // an opaque error, so the ids are confirmed up front.
    const found = await prisma.skill.count({ where: { id: { in: requiredSkillIds } } });
    if (found !== new Set(requiredSkillIds).size) {
      throw new HttpError({ message: "One or more required skills do not exist", status: 422 });
    }
  }

  // An unassigned task can require anything — the rule only binds a developer.
  if (!assigneeId) return;

  const developer = await prisma.developer.findUnique({
    where: { id: assigneeId },
    select: { skills: { select: { id: true } } },
  });
  if (!developer) {
    throw new HttpError({ message: "Assignee is not a known developer", status: 422 });
  }

  const held = new Set(developer.skills.map((skill) => skill.id));
  const missingIds = requiredSkillIds.filter((id) => !held.has(id));
  if (missingIds.length === 0) return;

  // Report names, not ids — the client is about to show this to a person.
  const missingSkills = await prisma.skill.findMany({
    where: { id: { in: missingIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  throw new HttpError({
    message: "Developer lacks the skills this task requires",
    status: 409,
    details: { missingSkills },
  });
}

/**
 * Business logic and persistence for tasks, backed by Prisma.
 *
 * Anything that can't be satisfied throws an `HttpError` carrying the status
 * to send, so a caller only ever handles the success path and `app.ts` writes
 * the error response.
 *
 * The controller imports this module as a namespace (`* as taskService`), so
 * these read as `taskService.listTasks()` at the call site.
 */

export async function listTasks() {
  return prisma.task.findMany({
    include: { assignee: true, requiredSkills: { orderBy: { name: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function findTaskById(id: string) {
  const row = await prisma.task.findUnique({
    where: { id },
    include: { assignee: true, requiredSkills: { orderBy: { name: "asc" } } },
  });
  if (!row) throw taskNotFound();

  return row;
}

export async function createTask(data: TCreateTask) {
  const assigneeId = data.assigneeId ?? null;
  const requiredSkillIds = data.requiredSkillIds;

  await assertAssignable(assigneeId, requiredSkillIds);

  return prisma.task.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      status: data.status,
      priority: data.priority,
      assigneeId,
      dueDate: data.dueDate ?? null,
      requiredSkills: { connect: requiredSkillIds.map((id) => ({ id })) },
    },
    include: { assignee: true, requiredSkills: { orderBy: { name: "asc" } } },
  });
}

/**
 * Reassign a task. The rule check runs against the skills the task already
 * requires, so an under-skilled developer is refused with a 409.
 */
export async function updateTask(id: string, data: TUpdateTask) {
  const current = await prisma.task.findUnique({
    where: { id },
    select: { requiredSkills: { select: { id: true } } },
  });
  if (!current) throw taskNotFound();

  await assertAssignable(
    data.assigneeId,
    current.requiredSkills.map((skill) => skill.id),
  );

  return prisma.task.update({
    where: { id },
    data: { assigneeId: data.assigneeId },
    include: { assignee: true, requiredSkills: { orderBy: { name: "asc" } } },
  });
}

/** Status-only change; the assignment rule is untouched by it. */
export async function updateTaskStatus(id: string, data: TUpdateTaskStatus) {
  const exists = await prisma.task.count({ where: { id } });
  if (exists === 0) throw taskNotFound();

  const status: TaskStatus = data.status;
  return prisma.task.update({
    where: { id },
    data: { status },
    include: { assignee: true, requiredSkills: { orderBy: { name: "asc" } } },
  });
}
