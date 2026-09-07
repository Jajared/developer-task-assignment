import { TaskStatus } from "@/generated/prisma/enums.ts";

import { prisma } from "@/db/prisma.ts";

/**
 * Seeds skills, developers and a few tasks for local development. Safe to
 * re-run: each table is filled only when it's empty, and skills are upserted
 * by their unique name.
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

/**
 * A task may only be assigned to a developer holding every skill it requires.
 * Nothing in the database enforces that, so these rows have to respect it by
 * hand — note that Carol is the only developer eligible for the task that
 * needs both skills.
 */
type SeedTask = {
  title: string;
  status: TaskStatus;
  requiredSkills: SkillName[];
  assignee: string | null;
  /** Nested subtasks, created under the task. A done task's must all be done. */
  subtasks?: SeedTask[];
};

const TASKS: SeedTask[] = [
  {
    title:
      "As a visitor, I want to see a responsive homepage so that I can easily navigate on both desktop and mobile devices.",
    status: TaskStatus.in_progress,
    requiredSkills: ["Frontend"],
    assignee: "Alice",
    subtasks: [
      {
        title: "Build the desktop layout",
        status: TaskStatus.done,
        requiredSkills: ["Frontend"],
        assignee: "Alice",
      },
      {
        title: "Adapt the layout for mobile",
        status: TaskStatus.todo,
        requiredSkills: ["Frontend"],
        assignee: "Alice",
        subtasks: [
          {
            title: "Collapse the navigation into a menu",
            status: TaskStatus.todo,
            requiredSkills: ["Frontend"],
            assignee: null,
          },
        ],
      },
    ],
  },
  {
    title: "Expose the task API over HTTP",
    status: TaskStatus.done,
    requiredSkills: ["Backend"],
    assignee: "Bob",
  },
  {
    title: "Wire the homepage to the task API",
    status: TaskStatus.todo,
    requiredSkills: ["Frontend", "Backend"],
    assignee: "Carol",
  },
  {
    title: "Point the frontend at Prisma",
    status: TaskStatus.todo,
    requiredSkills: ["Backend"],
    assignee: null,
  },
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

const taskCount = await prisma.task.count();

if (taskCount > 0) {
  console.log(`tasks skipped — ${taskCount} task(s) already present`);
} else {
  const developers = new Map(
    (await prisma.developer.findMany()).map((developer) => [developer.name, developer.id]),
  );

  // Subtasks need their parent's id, so each tree is written depth-first.
  let created = 0;
  const createTree = async (task: SeedTask, parentId: string | null): Promise<void> => {
    const row = await prisma.task.create({
      data: {
        title: task.title,
        status: task.status,
        assigneeId: task.assignee ? developers.get(task.assignee) : null,
        parentId,
        requiredSkills: {
          connect: task.requiredSkills.map((name) => ({ id: skills.get(name) })),
        },
      },
      select: { id: true },
    });
    created += 1;
    for (const subtask of task.subtasks ?? []) await createTree(subtask, row.id);
  };

  await Promise.all(TASKS.map((task) => createTree(task, null)));
  console.log(`seeded ${created} tasks (${TASKS.length} top-level)`);
}

await prisma.$disconnect();
