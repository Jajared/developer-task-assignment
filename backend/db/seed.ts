import { TaskStatus } from "../src/generated/prisma/enums.ts";

import { prisma } from "../src/db/prisma.ts";

/**
 * Seeds a couple of tasks for local development. Safe to re-run: it does
 * nothing once the table has rows.
 */
const count = await prisma.task.count();

if (count > 0) {
  console.log(`seed skipped — ${count} task(s) already present`);
} else {
  await prisma.task.createMany({
    data: [
      { title: "Wire up the monorepo", assignee: "jared", status: TaskStatus.done },
      { title: "Replace the in-memory store", assignee: null, status: TaskStatus.done },
      { title: "Point the frontend at Prisma", assignee: null, status: TaskStatus.todo },
    ],
  });
  console.log("seeded 3 tasks");
}

await prisma.$disconnect();
