import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";

import { createApp } from "@/app.ts";
import { prisma } from "@/db/prisma.ts";
import { MAX_SUBTASK_DEPTH } from "@/lib/constants.ts";

/**
 * The task rules, driven over HTTP against the real database. The app is
 * bound in-process on a throwaway port. Skills and developers are read from
 * the API rather than hardcoded, and every task this suite creates is deleted
 * in `afterAll` (a root's delete cascades to its subtasks), so the suite
 * leaves the shared database as it found it.
 *
 * Needs `bun run db:up` and a seeded database. Set `GEMINI_API_KEY` empty so
 * a skill-less fixture stays skill-less instead of hitting the LLM.
 */

type Skill = { id: string; name: string };
type Developer = { id: string; name: string; skills: Skill[] };
type Task = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  assigneeId: string | null;
  parentId: string | null;
  requiredSkills: Skill[];
};

let server: Server;
let base: string;
const createdRootIds: string[] = [];

// Fixtures picked from the seed: a developer with one skill, a skill they lack,
// and a developer who holds that skill.
let oneSkillDev: Developer;
let lackedSkill: Skill;
let holderDev: Developer;

async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<{ status: number; body: T }> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as T };
}

/** POST a tree, register the root for cleanup, and return the full flat list of its rows. */
async function createTree(body: Record<string, unknown>) {
  const created = await api<{ task: Task }>("POST", "/api/tasks", body);
  expect(created.status).toBe(201);
  createdRootIds.push(created.body.task.id);
  return created.body.task;
}

/** Every task row, so a test can find a subtask by title. */
async function allTasks(): Promise<Task[]> {
  return (await api<{ tasks: Task[] }>("GET", "/api/tasks")).body.tasks;
}

async function findByTitle(title: string): Promise<Task> {
  const task = (await allTasks()).find((t) => t.title === title);
  if (!task) throw new Error(`no task titled ${title}`);
  return task;
}

const setStatus = (id: string, status: Task["status"]) =>
  api<{ task: Task } & { error?: string; details?: unknown }>("PATCH", `/api/tasks/${id}/status`, { status });

/** Titles are suffixed so a test's rows are distinct from anything else in the shared database. */
const unique = (title: string) => `${title} [${crypto.randomUUID().slice(0, 8)}]`;

beforeAll(async () => {
  server = createApp().listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server did not bind a port");
  base = `http://127.0.0.1:${address.port}`;

  const developers = (await api<{ developers: Developer[] }>("GET", "/api/developers")).body.developers;
  const skills = (await api<{ skills: Skill[] }>("GET", "/api/skills")).body.skills;

  const one = developers.find((d) => d.skills.length === 1 && skills.some((s) => !d.skills.some((h) => h.id === s.id)));
  if (!one) throw new Error("seed needs a developer with exactly one skill who lacks another");
  oneSkillDev = one;
  lackedSkill = skills.find((s) => !one.skills.some((h) => h.id === s.id))!;
  const holder = developers.find((d) => d.skills.some((s) => s.id === lackedSkill.id));
  if (!holder) throw new Error(`seed needs a developer holding ${lackedSkill.name}`);
  holderDev = holder;
});

afterAll(async () => {
  if (createdRootIds.length > 0) {
    await prisma.task.deleteMany({ where: { id: { in: createdRootIds } } });
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.$disconnect();
});

describe("completion rule: a task is done only when every direct subtask is done", () => {
  test("PATCH /:id/status refuses done while subtasks are open, naming each one", async () => {
    const a = unique("open A");
    const b = unique("open B");
    const root = await createTree({ title: unique("parent"), subtasks: [{ title: a }, { title: b, status: "in_progress" }] });

    const refused = await setStatus(root.id, "done");
    expect(refused.status).toBe(409);
    expect(refused.body.error).toBe("All subtasks must be done before this task can be marked done");
    const open = (refused.body.details as { unfinishedSubtasks: { id: string; title: string; status: string }[] }).unfinishedSubtasks;
    expect(open.map((t) => t.title).sort()).toEqual([a, b].sort());
    expect(open.every((t) => typeof t.id === "string")).toBe(true);

    // The refused write left the parent untouched.
    expect((await api<{ task: Task }>("GET", `/api/tasks/${root.id}`)).body.task.status).toBe("todo");
  });

  test("finishing one subtask still leaves the parent blocked by the other", async () => {
    const a = unique("first");
    const b = unique("second");
    const root = await createTree({ title: unique("parent"), subtasks: [{ title: a }, { title: b }] });

    expect((await setStatus((await findByTitle(a)).id, "done")).status).toBe(200);

    const refused = await setStatus(root.id, "done");
    expect(refused.status).toBe(409);
    const open = (refused.body.details as { unfinishedSubtasks: { title: string }[] }).unfinishedSubtasks;
    expect(open.map((t) => t.title)).toEqual([b]);
  });

  test("once every subtask is done the parent can be done", async () => {
    const a = unique("first");
    const b = unique("second");
    const root = await createTree({ title: unique("parent"), subtasks: [{ title: a }, { title: b }] });

    expect((await setStatus((await findByTitle(a)).id, "done")).status).toBe(200);
    expect((await setStatus((await findByTitle(b)).id, "done")).status).toBe(200);

    const done = await setStatus(root.id, "done");
    expect(done.status).toBe(200);
    expect(done.body.task.status).toBe("done");
  });

  test("POST refuses a done task nested over an open subtask, and writes nothing", async () => {
    const title = unique("never written");
    const sub = unique("open leaf");
    const refused = await api<{ error: string; details: { unfinishedSubtasks: { id?: string; title: string; status: string }[] } }>(
      "POST",
      "/api/tasks",
      { title, status: "done", subtasks: [{ title: sub }] },
    );
    expect(refused.status).toBe(409);
    expect(refused.body.details.unfinishedSubtasks).toEqual([{ title: sub, status: "todo" }]);

    const titles = (await allTasks()).map((t) => t.title);
    expect(titles).not.toContain(title);
    expect(titles).not.toContain(sub);
  });

  test("POST accepts a done task whose subtasks are all done", async () => {
    const root = await createTree({
      title: unique("finished parent"),
      status: "done",
      subtasks: [{ title: unique("done leaf"), status: "done" }],
    });
    expect(root.status).toBe("done");
  });
});

describe("reopening: moving a done task back open reopens every done ancestor", () => {
  test("a reopened grandchild sets its done parent and grandparent to in_progress in one call", async () => {
    const child = unique("child");
    const grandchild = unique("grandchild");
    const root = await createTree({
      title: unique("grandparent"),
      status: "done",
      subtasks: [{ title: child, status: "done", subtasks: [{ title: grandchild, status: "done" }] }],
    });

    const reopened = await setStatus((await findByTitle(grandchild)).id, "todo");
    expect(reopened.status).toBe(200);
    expect(reopened.body.task.status).toBe("todo");

    expect((await findByTitle(child)).status).toBe("in_progress");
    expect((await api<{ task: Task }>("GET", `/api/tasks/${root.id}`)).body.task.status).toBe("in_progress");
  });

  test("the walk stops at the first ancestor that is already open", async () => {
    const child = unique("child");
    const grandchild = unique("grandchild");
    const root = await createTree({
      title: unique("open grandparent"),
      status: "todo",
      subtasks: [{ title: child, status: "done", subtasks: [{ title: grandchild, status: "done" }] }],
    });

    expect((await setStatus((await findByTitle(grandchild)).id, "in_progress")).status).toBe(200);

    expect((await findByTitle(child)).status).toBe("in_progress");
    // Already open; must not be touched (it stays `todo`, not bumped to `in_progress`).
    expect((await api<{ task: Task }>("GET", `/api/tasks/${root.id}`)).body.task.status).toBe("todo");
  });

  test("re-sending done for an already-done subtask leaves the done parent alone", async () => {
    const child = unique("child");
    const root = await createTree({ title: unique("parent"), status: "done", subtasks: [{ title: child, status: "done" }] });

    const same = await setStatus((await findByTitle(child)).id, "done");
    expect(same.status).toBe(200);
    expect((await api<{ task: Task }>("GET", `/api/tasks/${root.id}`)).body.task.status).toBe("done");
  });
});

describe("assignment rule: a task is held only by a developer with every required skill", () => {
  test("POST refuses an assignee who lacks a required skill, naming the missing skill", async () => {
    const refused = await api<{ error: string; details: { missingSkills: Skill[] } }>("POST", "/api/tasks", {
      title: unique("needs a skill"),
      requiredSkillIds: [lackedSkill.id],
      assigneeId: oneSkillDev.id,
    });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toBe("Developer lacks the skills this task requires");
    expect(refused.body.details.missingSkills).toEqual([{ id: lackedSkill.id, name: lackedSkill.name }]);
  });

  test("the rule applies to a nested subtask too, and then nothing in the tree is written", async () => {
    const rootTitle = unique("fine root");
    const refused = await api("POST", "/api/tasks", {
      title: rootTitle,
      requiredSkillIds: oneSkillDev.skills.map((s) => s.id),
      assigneeId: oneSkillDev.id,
      subtasks: [{ title: unique("bad leaf"), requiredSkillIds: [lackedSkill.id], assigneeId: oneSkillDev.id }],
    });
    expect(refused.status).toBe(409);
    expect((await allTasks()).map((t) => t.title)).not.toContain(rootTitle);
  });

  test("PATCH /:id refuses reassigning to an under-skilled developer and accepts a qualified one", async () => {
    const task = await createTree({ title: unique("skilled work"), requiredSkillIds: [lackedSkill.id] });

    const refused = await api<{ details: { missingSkills: Skill[] } }>("PATCH", `/api/tasks/${task.id}`, {
      assigneeId: oneSkillDev.id,
    });
    expect(refused.status).toBe(409);
    expect(refused.body.details.missingSkills.map((s) => s.id)).toEqual([lackedSkill.id]);

    const assigned = await api<{ task: Task }>("PATCH", `/api/tasks/${task.id}`, { assigneeId: holderDev.id });
    expect(assigned.status).toBe(200);
    expect(assigned.body.task.assigneeId).toBe(holderDev.id);

    const unassigned = await api<{ task: Task }>("PATCH", `/api/tasks/${task.id}`, { assigneeId: null });
    expect(unassigned.status).toBe(200);
    expect(unassigned.body.task.assigneeId).toBeNull();
  });

  test("an unknown assignee or skill is a 422, not a 409", async () => {
    const ghost = "00000000-0000-4000-8000-000000000000";
    const badDev = await api<{ error: string }>("POST", "/api/tasks", { title: unique("x"), assigneeId: ghost });
    expect(badDev.status).toBe(422);
    expect(badDev.body.error).toBe("Assignee is not a known developer");

    const badSkill = await api<{ error: string }>("POST", "/api/tasks", { title: unique("x"), requiredSkillIds: [ghost] });
    expect(badSkill.status).toBe(422);
    expect(badSkill.body.error).toBe("One or more required skills do not exist");
  });
});

describe("nesting depth", () => {
  const nest = (depth: number): Record<string, unknown> =>
    depth === 0 ? { title: unique("leaf") } : { title: unique(`level ${depth}`), subtasks: [nest(depth - 1)] };

  test(`accepts a tree ${MAX_SUBTASK_DEPTH} levels deep`, async () => {
    const root = await createTree(nest(MAX_SUBTASK_DEPTH));
    expect(root.id).toBeString();
  });

  test(`refuses a tree ${MAX_SUBTASK_DEPTH + 1} levels deep with a 422 and writes nothing`, async () => {
    const body = nest(MAX_SUBTASK_DEPTH + 1);
    const refused = await api<{ error: string; details: { maxDepth: number; depth: number } }>("POST", "/api/tasks", body);
    expect(refused.status).toBe(422);
    expect(refused.body.details).toEqual({ maxDepth: MAX_SUBTASK_DEPTH, depth: MAX_SUBTASK_DEPTH + 1 });
    expect((await allTasks()).map((t) => t.title)).not.toContain(body.title);
  });
});
