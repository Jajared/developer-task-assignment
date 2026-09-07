import { prisma } from "@/db/prisma.ts";

/**
 * Seeds the reference data — skills and developers — for local development.
 * Tasks are not seeded; create them through the app. Safe to re-run: skills
 * are upserted by their unique name, developers only when the table is empty.
 */

/** Skills are shared — a developer has them, a task requires them. */
const SKILLS = ["Frontend", "Backend"] as const;

type SkillName = (typeof SKILLS)[number];

const DEVELOPERS: { name: string; skills: SkillName[] }[] = [
  { name: "Alice", skills: ["Frontend"] },
  { name: "Bob", skills: ["Backend"] },
  { name: "Carol", skills: ["Frontend", "Backend"] },
  { name: "Dave", skills: ["Backend"] },
];

// Upsert rather than count: the name column is unique, so re-running just
// re-finds the existing rows and later seeds can rely on them being here.
const skills = new Map(
  await Promise.all(
    SKILLS.map(async (name) => {
      const skill = await prisma.skill.upsert({
        where: { name },
        update: {},
        create: { name },
      });
      return [name, skill.id] as const;
    }),
  ),
);

const developerCount = await prisma.developer.count();

if (developerCount > 0) {
  console.log(`developers skipped — ${developerCount} already present`);
} else {
  // createMany can't write the join rows, so each developer is created with
  // its skills connected.
  await Promise.all(
    DEVELOPERS.map((developer) =>
      prisma.developer.create({
        data: {
          name: developer.name,
          skills: { connect: developer.skills.map((name) => ({ id: skills.get(name) })) },
        },
      }),
    ),
  );
  console.log(`seeded ${DEVELOPERS.length} developers`);
}

await prisma.$disconnect();
