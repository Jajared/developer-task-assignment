import { z } from "zod/v4";

import { prisma } from "@/db/prisma.ts";
import { HttpError } from "@/lib/http-error.ts";
import { generateStructured, isLlmConfigured } from "@/lib/llm.ts";
import { describeError, getLogger } from "@/lib/log.ts";

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

const INFERENCE_INSTRUCTION = `You classify software development tasks by the skill(s) a developer needs to complete them.
You are given a task title (and sometimes a description) plus the list of skills that exist.
Return a JSON array containing every listed skill the task requires, and nothing else.
Choose only from the listed skills, spelled exactly as given. Return an empty array if none apply.

Examples, for skills [Frontend, Backend]:
- "As a visitor, I want to see a responsive homepage so that I can easily navigate on both desktop and mobile devices." -> ["Frontend"]
- "As a system administrator, I want audit logs of all data access and modifications so that I can ensure compliance with data protection regulations and investigate any security incidents." -> ["Backend"]
- "As a logged-in user, I want to update my profile information and upload a profile picture so that my account details are accurate and personalized." -> ["Frontend", "Backend"]`;

/**
 * The inference rule: which of the existing skills does a task need, judged
 * from its title (and description, when there is one)? The model is
 * constrained to the current `Skill` rows — `z.enum` of their names drives
 * both Gemini's response schema and the strict parse of its reply — so the
 * answer can only ever name skills that exist, and comes back as their ids.
 *
 * Never throws. No key, a network fault, a quota error or an off-shape reply
 * all yield `[]`, because a missing inference must never stop a task from
 * being created. The warning is logged here; callers just use the result.
 */
export async function inferRequiredSkillIds(task: {
  title: string;
  description?: string | null;
}): Promise<string[]> {
  if (!isLlmConfigured()) return [];

  const skills = await prisma.skill.findMany({ select: { id: true, name: true } });
  if (skills.length === 0) return [];
  const idByName = new Map(skills.map((skill) => [skill.name, skill.id]));
  const names = [...idByName.keys()] as [string, ...string[]];

  const prompt = [
    `Skills: ${names.join(", ")}`,
    `Task title: ${task.title}`,
    task.description ? `Task description: ${task.description}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const picked = await generateStructured({
      schema: z.array(z.enum(names)),
      systemInstruction: INFERENCE_INSTRUCTION,
      prompt,
    });
    const unique = [...new Set(picked)];
    getLogger().info("Inferred required skills", { title: task.title, skills: unique });
    return unique.map((name) => idByName.get(name)!);
  } catch (error) {
    getLogger().warn("Skill inference failed", { title: task.title, error: describeError(error) });
    return [];
  }
}
