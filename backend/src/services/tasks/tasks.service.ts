import { Conflict, NotFound, UnprocessableEntity } from "http-errors";

import { prisma } from "@/db/prisma.ts";
import { MAX_SUBTASK_DEPTH } from "@/lib/constants.ts";
import { getLogger } from "@/lib/log.ts";
import { TaskStatus } from "@/generated/prisma/enums.ts";
import type { Prisma } from "@/generated/prisma/client.ts";
import * as skillService from "@/services/skills/skills.service.ts";
import type { TCreateTask, TUpdateTask, TUpdateTaskStatus } from "./tasks.validator.ts";

/**
 * Every skill named anywhere in a create body must exist: connecting one that
 * doesn't would fail deep inside Prisma with an opaque error, so it's a 422
 * here instead — the body names a row that isn't there.
 *
 * Takes the whole tree's ids at once, deduped, so a 50-task payload costs one
 * query rather than one per node. An unknown assignee is the same kind of 422,
 * but `assertHoldsRequiredSkills` already raises it, so it isn't checked twice.
 */
async function assertSkillsExist(requiredSkillIds: ReadonlySet<string>): Promise<void> {
  if (requiredSkillIds.size === 0) return;

  const found = await prisma.skill.count({ where: { id: { in: [...requiredSkillIds] } } });
  if (found !== requiredSkillIds.size) {
    throw new UnprocessableEntity("One or more required skills do not exist");
  }
}

/** The skill ids each of the named developers holds. A developer that doesn't exist is absent. */
async function loadHeldSkills(assigneeIds: ReadonlySet<string>): Promise<Map<string, Set<string>>> {
  if (assigneeIds.size === 0) return new Map();

  const developers = await prisma.developer.findMany({
    where: { id: { in: [...assigneeIds] } },
    select: { id: true, skills: { select: { id: true } } },
  });
  return new Map(
    developers.map((developer) => [developer.id, new Set(developer.skills.map((skill) => skill.id))]),
  );
}

/**
 * The assignment rule for one task: it may only be held by a developer who has
 * every skill it requires. Nothing in the database enforces this — the join
 * tables are independent — so it's checked here, against the state the task
 * will have *after* the write, not the state it has now.
 *
 * `held` is what that developer holds, from `loadHeldSkills`, or undefined
 * when no such developer exists. Throws 422 for the unknown developer, 409
 * when they're real but under-skilled (the request was fine, the data refused
 * it). This is the only place either is judged, on both the create and the
 * update path.
 */
async function assertHoldsRequiredSkills(
  assigneeId: string,
  requiredSkillIds: string[],
  held: ReadonlySet<string> | undefined,
): Promise<void> {
  if (!held) {
    throw new UnprocessableEntity("Assignee is not a known developer");
  }

  const missingIds = requiredSkillIds.filter((id) => !held.has(id));
  if (missingIds.length === 0) return;

  // Report names, not ids — the client is about to show this to a person.
  const missingSkills = await prisma.skill.findMany({
    where: { id: { in: missingIds } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  getLogger().warn("Assignment refused: developer lacks required skills", {
    assigneeId,
    missingSkills: missingSkills.map((skill) => skill.name),
  });
  const names = missingSkills.map((skill) => skill.name).join(", ");
  throw Object.assign(
    new Conflict(`Developer lacks the skills this task requires: ${names}`),
    { details: { missingSkills } },
  );
}

/** The assignment rule for a single task, on the update path. */
async function assertAssignable(
  assigneeId: string | null,
  requiredSkillIds: string[],
): Promise<void> {
  // An unassigned task can require anything — the rule only binds a developer.
  if (!assigneeId) return;

  const held = await loadHeldSkills(new Set([assigneeId]));
  await assertHoldsRequiredSkills(assigneeId, requiredSkillIds, held.get(assigneeId));
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

  getLogger().warn("Completion refused: subtasks still open", {
    unfinishedSubtasks: unfinishedSubtasks.map(({ id, status }) => ({ id, status })),
  });
  const titles = unfinishedSubtasks.map((subtask) => subtask.title).join(", ");
  throw Object.assign(
    new Conflict(`All subtasks must be done before this task can be marked done: ${titles}`),
    { details: { unfinishedSubtasks } },
  );
}

/**
 * The nesting rule: a subtask may sit at most `MAX_SUBTASK_DEPTH` levels
 * below its root (root is depth 0). The schema itself allows any depth; only
 * this check, run on the create path, bounds it.
 */
function assertWithinDepth(depth: number): void {
  if (depth <= MAX_SUBTASK_DEPTH) return;
  throw Object.assign(new UnprocessableEntity(`Subtasks may be nested at most ${MAX_SUBTASK_DEPTH} levels deep`), {
    details: { maxDepth: MAX_SUBTASK_DEPTH, depth },
  });
}

/**
 * The checks decidable from the payload alone, run over a create body and its
 * nested subtasks *before* any query or LLM call: depth and the completion
 * rule. Depth-first, in payload order, so the first offending task is the one
 * reported. `depth` is 0 for the root.
 */
function assertTreeWellFormed(task: TCreateTask, depth = 0): void {
  assertWithinDepth(depth);
  assertCompletable(task.status, task.subtasks);
  for (const subtask of task.subtasks) assertTreeWellFormed(subtask, depth + 1);
}

/** Collects a field from every task in the tree into one deduped set. */
function collectIds(
  task: TCreateTask,
  pick: (task: TCreateTask) => string | string[] | null | undefined,
  into: Set<string> = new Set(),
): Set<string> {
  const picked = pick(task);
  if (picked) for (const id of typeof picked === "string" ? [picked] : picked) into.add(id);
  for (const subtask of task.subtasks) collectIds(subtask, pick, into);
  return into;
}

/**
 * The assignment rule over the whole tree, run *after* inference so it judges
 * the skills each task will actually require — inferred or explicit.
 *
 * Every developer the tree names is fetched once, up front, and each task is
 * judged against that map: one query for the payload rather than one per node,
 * and a developer assigned to several subtasks is fetched once.
 */
async function assertTreeAssignable(task: TCreateTask): Promise<void> {
  const held = await loadHeldSkills(collectIds(task, (node) => node.assigneeId));

  const walk = async (node: TCreateTask): Promise<void> => {
    if (node.assigneeId) {
      await assertHoldsRequiredSkills(node.assigneeId, node.requiredSkillIds, held.get(node.assigneeId));
    }
    for (const subtask of node.subtasks) await walk(subtask);
  };
  await walk(task);
}

/** True if this task or any subtask below it was sent without required skills. */
function hasSkillless(task: TCreateTask): boolean {
  return task.requiredSkillIds.length === 0 || task.subtasks.some(hasSkillless);
}

/**
 * A task sent without required skills gets them inferred from its title —
 * `skillService.inferRequiredSkillIds()` owns how. Runs over the whole tree at
 * once, so several skill-less subtasks cost one round-trip in wall time, not
 * one each. Returns a new tree; the input is left alone.
 *
 * Inference never fails the request — a missing key or a model error leaves
 * that task with no skills.
 */
async function fillInferredSkills(task: TCreateTask): Promise<TCreateTask> {
  if (!hasSkillless(task)) return task;

  const fill = async (node: TCreateTask): Promise<TCreateTask> => {
    const [requiredSkillIds, subtasks] = await Promise.all([
      node.requiredSkillIds.length > 0
        ? node.requiredSkillIds
        : skillService.inferRequiredSkillIds({ title: node.title, description: node.description }),
      Promise.all(node.subtasks.map(fill)),
    ]);
    return { ...node, requiredSkillIds, subtasks };
  };
  return fill(task);
}

/** Writes one task and, recursively, its subtasks under it. Returns the root id. */
async function createTree(
  db: Prisma.TransactionClient,
  task: TCreateTask,
  parentId: string | null,
): Promise<string> {
  const row = await db.task.create({
    data: {
      title: task.title,
      description: task.description ?? null,
      status: task.status,
      assigneeId: task.assigneeId ?? null,
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
 * Anything that can't be satisfied throws an `http-errors` error carrying the status
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
  if (!row) throw new NotFound("Task not found");

  return row;
}

/**
 * Create a task and, in the same transaction, every subtask nested in the
 * payload, in three steps:
 *
 * 1. The payload-only checks — depth and the completion rule — run first, then
 *    one query for every skill the tree names, so a body that is going to be
 *    refused never triggers an LLM call.
 * 2. Any node sent without required skills has them inferred.
 * 3. The assignment rule runs over the *inferred* skills, so an assignee who
 *    lacks them is refused (409) just as if the client had named them. The
 *    developers the tree names are fetched in one query for the same reason.
 *
 * Each stage is one round trip for the whole payload, not one per node.
 *
 * A bad leaf at any step means nothing is written. Subtasks are only ever
 * created this way — there is no route to attach one to an existing task.
 *
 * The response is the root row alone; subtasks are ordinary rows in the list,
 * each carrying its `parentId`.
 */
export async function createTask(input: TCreateTask) {
  assertTreeWellFormed(input);
  await assertSkillsExist(collectIds(input, (node) => node.requiredSkillIds));
  const data = await fillInferredSkills(input);
  await assertTreeAssignable(data);

  const task = await prisma.$transaction(async (tx) => {
    const id = await createTree(tx, data, null);
    return tx.task.findUniqueOrThrow({
      where: { id },
      include: { assignee: true, requiredSkills: { orderBy: { name: "asc" } } },
    });
  });

  getLogger().info("Task created", {
    taskId: task.id,
    status: task.status,
    assigneeId: task.assigneeId,
    requiredSkills: task.requiredSkills.map((skill) => skill.name),
    subtaskCount: countSubtasks(data),
  });
  return task;
}

/** Every node below the root, at any depth. */
function countSubtasks(task: TCreateTask): number {
  return task.subtasks.reduce((total, subtask) => total + 1 + countSubtasks(subtask), 0);
}

/**
 * Reassign a task. The rule check runs against the skills the task already
 * requires, so an under-skilled developer is refused with a 409.
 */
export async function updateTask(id: string, data: TUpdateTask) {
  const current = await prisma.task.findUnique({
    where: { id },
    select: { assigneeId: true, requiredSkills: { select: { id: true } } },
  });
  if (!current) throw new NotFound("Task not found");

  await assertAssignable(
    data.assigneeId,
    current.requiredSkills.map((skill) => skill.id),
  );

  const task = await prisma.task.update({
    where: { id },
    data: { assigneeId: data.assigneeId },
    include: { assignee: true, requiredSkills: { orderBy: { name: "asc" } } },
  });

  getLogger().info(data.assigneeId ? "Task assigned" : "Task unassigned", {
    taskId: id,
    from: current.assigneeId,
    to: data.assigneeId,
  });
  return task;
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
  if (!current) throw new NotFound("Task not found");

  const status: TaskStatus = data.status;
  assertCompletable(status, current.subtasks);

  const reopening = current.status === TaskStatus.done && status !== TaskStatus.done;

  const reopenedAncestorIds: string[] = [];

  const row = await prisma.$transaction(async (tx) => {
    const row = await tx.task.update({
      where: { id },
      data: { status },
      include: { assignee: true, requiredSkills: { orderBy: { name: "asc" } } },
    });

    let parentId = reopening ? current.parentId : null;
    while (parentId) {
      const parent = await tx.task.findUniqueOrThrow({
        where: { id: parentId },
        select: { status: true, parentId: true },
      });
      if (parent.status !== TaskStatus.done) break;
      await tx.task.update({
        where: { id: parentId },
        data: { status: TaskStatus.todo },
      });
      reopenedAncestorIds.push(parentId);
      parentId = parent.parentId;
    }

    return row;
  });

  getLogger().info("Task status changed", {
    taskId: id,
    from: current.status,
    to: status,
    ...(reopenedAncestorIds.length > 0 && { reopenedAncestorIds }),
  });
  return row;
}
