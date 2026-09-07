import { prisma } from "@/db/prisma.ts";
import { HttpError } from "@/lib/http-error.ts";
import { TaskStatus } from "@/generated/prisma/enums.ts";
import type { TCreateTask, TUpdateTask, TUpdateTaskStatus } from "./tasks.validator.ts";

/** The relations every task response carries, written once and reused. */
const taskInclude = {
  assignee: true,
  requiredSkills: { orderBy: { name: "asc" } },
} as const;

/** A transaction client or the plain client — the tree create takes either. */
type Db = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

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
 * The completion rule: a task may only be `done` once every one of its direct
 * subtasks is. Direct children are enough — the rule holds at every level, so
 * a done child already vouches for its own subtree.
 *
 * Throws a 409 naming the subtasks still open. On the create path the rows
 * don't exist yet, so `id` is absent there.
 */
function assertCompletable(
  status: TaskStatus,
  subtasks: { id?: string; title: string; status: TaskStatus }[],
): void {
  if (status !== TaskStatus.done) return;

  // Pick the fields explicitly: on the create path these are whole payload
  // nodes, and their nested subtasks must not end up in the response.
  const unfinishedSubtasks = subtasks
    .filter((subtask) => subtask.status !== TaskStatus.done)
    .map(({ id, title, status }) => ({ ...(id && { id }), title, status }));
  if (unfinishedSubtasks.length === 0) return;

  throw new HttpError({
    message: "All subtasks must be done before this task can be marked done",
    status: 409,
    details: { unfinishedSubtasks },
  });
}

/**
 * Runs both rules over a create payload and every nested subtask, before any
 * row is written. Depth-first, in payload order, so the first offending task
 * is the one reported.
 */
async function assertTreeValid(task: TCreateTask): Promise<void> {
  await assertAssignable(task.assigneeId ?? null, task.requiredSkillIds);
  assertCompletable(task.status, task.subtasks);
  for (const subtask of task.subtasks) await assertTreeValid(subtask);
}

/** Writes one task and, recursively, its subtasks under it. Returns the root id. */
async function createTree(db: Db, task: TCreateTask, parentId: string | null): Promise<string> {
  const row = await db.task.create({
    data: {
      title: task.title,
      description: task.description ?? null,
      status: task.status,
      priority: task.priority,
      assigneeId: task.assigneeId ?? null,
      dueDate: task.dueDate ?? null,
      parentId,
      requiredSkills: { connect: task.requiredSkillIds.map((id) => ({ id })) },
    },
    select: { id: true },
  });
  for (const subtask of task.subtasks) await createTree(db, subtask, row.id);
  return row.id;
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
    include: taskInclude,
    orderBy: { createdAt: "desc" },
  });
}

export async function findTaskById(id: string) {
  const row = await prisma.task.findUnique({ where: { id }, include: taskInclude });
  if (!row) throw taskNotFound();

  return row;
}

/**
 * Create a task and, in the same transaction, every subtask nested in the
 * payload. Both rules are checked for the whole tree first, so a bad leaf
 * means nothing is written. Subtasks are only ever created this way — there
 * is no route to attach one to an existing task.
 *
 * The response is the root row alone; subtasks are ordinary rows in the list,
 * each carrying its `parentId`.
 */
export async function createTask(data: TCreateTask) {
  await assertTreeValid(data);

  return prisma.$transaction(async (tx) => {
    const id = await createTree(tx, data, null);
    return tx.task.findUniqueOrThrow({ where: { id }, include: taskInclude });
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
    include: taskInclude,
  });
}

/**
 * Status-only change; the assignment rule is untouched by it, but the
 * completion rule applies in both directions:
 *
 * - Moving to `done` is refused (409) while any direct subtask is not done.
 * - Moving a done task back to open reopens every done ancestor above it, in
 *   the same transaction, so a parent is never left done over open work.
 *   The walk stops at the first ancestor that is already open.
 */
export async function updateTaskStatus(id: string, data: TUpdateTaskStatus) {
  const current = await prisma.task.findUnique({
    where: { id },
    select: {
      status: true,
      parentId: true,
      subtasks: { select: { id: true, title: true, status: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!current) throw taskNotFound();

  const status: TaskStatus = data.status;
  assertCompletable(status, current.subtasks);

  const reopening = current.status === TaskStatus.done && status !== TaskStatus.done;

  return prisma.$transaction(async (tx) => {
    const row = await tx.task.update({ where: { id }, data: { status }, include: taskInclude });

    let parentId = reopening ? current.parentId : null;
    while (parentId) {
      const parent = await tx.task.findUniqueOrThrow({
        where: { id: parentId },
        select: { status: true, parentId: true },
      });
      if (parent.status !== TaskStatus.done) break;
      await tx.task.update({
        where: { id: parentId },
        data: { status: TaskStatus.in_progress },
      });
      parentId = parent.parentId;
    }

    return row;
  });
}
