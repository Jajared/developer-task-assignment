import { afterAll, afterEach, beforeAll, describe, expect, spyOn, test } from "bun:test";
import type { Server } from "node:http";

import { createApp } from "@/app.ts";
import { MAX_SUBTASK_DEPTH } from "@/lib/constants.ts";
import { prisma } from "@/db/prisma.ts";
import * as llm from "@/lib/llm.ts";
import { inferRequiredSkillIds } from "./skills.service.ts";

/**
 * Skill inference, with the model stubbed. `generateStructured` is the one
 * function that talks to Gemini, so it's replaced with `spyOn` and the tests
 * script its answer — the right names, wrong names, an error, a timeout —
 * and check what the rule does with each. `isLlmConfigured` is stubbed to
 * `true` so the rule runs even though the test env has no key.
 *
 * Needs the seeded database for the Skill rows and, in the HTTP block, for
 * developers. Every task created is deleted in `afterAll`.
 */

type Skill = { id: string; name: string };
type Developer = { id: string; name: string; skills: Skill[] };
type Task = { id: string; title: string; assigneeId: string | null; requiredSkills: Skill[] };

let skills: Skill[];
let configured: ReturnType<typeof spyOn<typeof llm, "isLlmConfigured">>;
let generate: ReturnType<typeof spyOn<typeof llm, "generateStructured">>;

const byName = (name: string) => skills.find((s) => s.name === name)!;

beforeAll(async () => {
  skills = await prisma.skill.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  if (skills.length < 2) throw new Error("seed needs at least two skills");
});

afterEach(() => {
  configured?.mockRestore();
  generate?.mockRestore();
});

/** Script the next model answer (or failure). */
function stubModel(answer: unknown[] | Error) {
  configured = spyOn(llm, "isLlmConfigured").mockReturnValue(true);
  generate = spyOn(llm, "generateStructured").mockImplementation((async () => {
    if (answer instanceof Error) throw answer;
    return answer;
  }) as typeof llm.generateStructured);
}

describe("inferRequiredSkillIds", () => {
  test("without a key it returns [] and never calls the model", async () => {
    configured = spyOn(llm, "isLlmConfigured").mockReturnValue(false);
    generate = spyOn(llm, "generateStructured");
    expect(await inferRequiredSkillIds({ title: "Anything" })).toEqual([]);
    expect(generate).not.toHaveBeenCalled();
  });

  test("maps the names the model picks back to skill ids", async () => {
    const [a, b] = skills;
    stubModel([a!.name, b!.name]);
    const ids = await inferRequiredSkillIds({ title: "Full-stack feature" });
    expect(ids.sort()).toEqual([a!.id, b!.id].sort());
  });

  test("constrains the model to the existing skills and puts the title in the prompt", async () => {
    stubModel([]);
    await inferRequiredSkillIds({ title: "Fix the header", description: "It overlaps the nav" });
    expect(generate).toHaveBeenCalledTimes(1);
    const args = generate.mock.calls[0]![0];
    // The response schema is an enum of exactly the current Skill names.
    expect(llm.toResponseJsonSchema(args.schema)).toMatchObject({
      type: "array",
      items: { enum: expect.arrayContaining(skills.map((s) => s.name)) },
    });
    expect(args.prompt).toContain("Fix the header");
    expect(args.prompt).toContain("It overlaps the nav");
    expect(args.prompt).toContain(skills.map((s) => s.name).join(", "));
  });

  test("dedupes a repeated pick", async () => {
    const a = skills[0]!;
    stubModel([a.name, a.name]);
    expect(await inferRequiredSkillIds({ title: "Repeat" })).toEqual([a.id]);
  });

  test("an empty pick is an empty list", async () => {
    stubModel([]);
    expect(await inferRequiredSkillIds({ title: "Write the release notes" })).toEqual([]);
  });

  test("a model error is swallowed into []", async () => {
    stubModel(new Error("429 quota exceeded"));
    expect(await inferRequiredSkillIds({ title: "Anything" })).toEqual([]);
  });

  test("a timeout is swallowed into []", async () => {
    stubModel(new DOMException("The operation timed out", "TimeoutError"));
    expect(await inferRequiredSkillIds({ title: "Anything" })).toEqual([]);
  });
});

describe("inference on the create path", () => {
  let server: Server;
  let base: string;
  const createdRootIds: string[] = [];
  let oneSkillDev: Developer;
  let lackedSkill: Skill;

  const post = async <T,>(body: unknown) => {
    const res = await fetch(`${base}/api/tasks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as T };
  };
  const unique = (title: string) => `${title} [${crypto.randomUUID().slice(0, 8)}]`;

  beforeAll(async () => {
    server = createApp().listen(0);
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("server did not bind a port");
    base = `http://127.0.0.1:${address.port}`;

    const developers = await prisma.developer.findMany({ include: { skills: { select: { id: true, name: true } } } });
    const one = developers.find((d) => d.skills.length === 1);
    if (!one) throw new Error("seed needs a developer with exactly one skill");
    oneSkillDev = one;
    lackedSkill = skills.find((s) => !one.skills.some((h) => h.id === s.id))!;
  });

  afterAll(async () => {
    if (createdRootIds.length > 0) await prisma.task.deleteMany({ where: { id: { in: createdRootIds } } });
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await prisma.$disconnect();
  });

  test("a task sent without skills comes back with the inferred ones attached", async () => {
    stubModel([lackedSkill.name]);
    const res = await post<{ task: Task }>({ title: unique("infer me") });
    expect(res.status).toBe(201);
    createdRootIds.push(res.body.task.id);
    expect(res.body.task.requiredSkills.map((s) => s.name)).toEqual([lackedSkill.name]);
  });

  test("a task sent with explicit skills never calls the model", async () => {
    stubModel([lackedSkill.name]);
    const res = await post<{ task: Task }>({ title: unique("explicit"), requiredSkillIds: [skills[0]!.id] });
    expect(res.status).toBe(201);
    createdRootIds.push(res.body.task.id);
    expect(generate).not.toHaveBeenCalled();
  });

  test("the assignment rule is judged against the inferred skills — an under-skilled assignee is a 409", async () => {
    stubModel([lackedSkill.name]);
    const res = await post<{ error: string; details: { missingSkills: Skill[] } }>({
      title: unique("inferred then refused"),
      assigneeId: oneSkillDev.id,
    });
    expect(res.status).toBe(409);
    expect(res.body.details.missingSkills.map((s) => s.name)).toEqual([lackedSkill.name]);
  });

  test("inference runs for every skill-less subtask, and each gets its own answer", async () => {
    configured = spyOn(llm, "isLlmConfigured").mockReturnValue(true);
    const [a, b] = skills;
    generate = spyOn(llm, "generateStructured").mockImplementation((async ({ prompt }: { prompt: string }) =>
      prompt.includes("child A") ? [a!.name] : [b!.name]) as typeof llm.generateStructured);
    const childA = unique("child A");
    const childB = unique("child B");
    const res = await post<{ task: Task }>({
      title: unique("root with explicit"),
      requiredSkillIds: [a!.id],
      subtasks: [{ title: childA }, { title: childB }],
    });
    expect(res.status).toBe(201);
    createdRootIds.push(res.body.task.id);
    expect(generate).toHaveBeenCalledTimes(2);

    const rows = await prisma.task.findMany({
      where: { parentId: res.body.task.id },
      select: { title: true, requiredSkills: { select: { name: true } } },
    });
    expect(rows.find((r) => r.title === childA)?.requiredSkills.map((s) => s.name)).toEqual([a!.name]);
    expect(rows.find((r) => r.title === childB)?.requiredSkills.map((s) => s.name)).toEqual([b!.name]);
  });

  test("a model failure never fails the create — the task is created with no skills", async () => {
    stubModel(new Error("model unavailable"));
    const res = await post<{ task: Task }>({ title: unique("model down") });
    expect(res.status).toBe(201);
    createdRootIds.push(res.body.task.id);
    expect(res.body.task.requiredSkills).toEqual([]);
  });

  test("a body that fails the cheap checks never reaches the model", async () => {
    stubModel([lackedSkill.name]);
    // Nested one level too deep, and skill-less at every level, so inference
    // is exactly what the depth check saves.
    const nest = (depth: number): Record<string, unknown> =>
      depth === 0 ? { title: unique("leaf") } : { title: unique("branch"), subtasks: [nest(depth - 1)] };
    const res = await post(nest(MAX_SUBTASK_DEPTH + 1));
    expect(res.status).toBe(422);
    expect(generate).not.toHaveBeenCalled();
  });

  test("an unknown assignee is still a 422, though it costs an inference first", async () => {
    stubModel([]);
    const res = await post<{ error: string }>({
      title: unique("bad assignee"),
      assigneeId: "00000000-0000-4000-8000-000000000000",
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe("Assignee is not a known developer");
  });
});
