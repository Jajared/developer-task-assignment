import { describe, expect, test } from "bun:test";

import { MAX_SUBTASKS_PER_TASK, MAX_TASKS_PER_CREATE } from "@/lib/constants.ts";
import { validateCreateTask, validateUpdateTask, validateUpdateTaskStatus } from "./tasks.validator.ts";

/**
 * The size caps on a create body. Pure — no database — so this runs anywhere.
 * Depth is the service's rule and is covered by the HTTP suite.
 */

const leaves = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `leaf ${i}` }));

describe("validateCreateTask", () => {
  test("defaults subtasks, status and requiredSkillIds", () => {
    const task = validateCreateTask({ title: "  Root  " });
    expect(task).toMatchObject({ title: "Root", status: "todo", requiredSkillIds: [], subtasks: [] });
  });

  test(`accepts ${MAX_SUBTASKS_PER_TASK} direct subtasks`, () => {
    const task = validateCreateTask({ title: "Root", subtasks: leaves(MAX_SUBTASKS_PER_TASK) });
    expect(task.subtasks).toHaveLength(MAX_SUBTASKS_PER_TASK);
  });

  test(`refuses ${MAX_SUBTASKS_PER_TASK + 1} direct subtasks with a 422 naming the field`, () => {
    expect(() => validateCreateTask({ title: "Root", subtasks: leaves(MAX_SUBTASKS_PER_TASK + 1) })).toThrow(
      expect.objectContaining({
        status: 422,
        details: expect.objectContaining({
          fieldErrors: { subtasks: [`A task may have at most ${MAX_SUBTASKS_PER_TASK} direct subtasks`] },
        }),
      }),
    );
  });

  test("applies the breadth cap at every level, not only the root", () => {
    const body = { title: "Root", subtasks: [{ title: "Child", subtasks: leaves(MAX_SUBTASKS_PER_TASK + 1) }] };
    expect(() => validateCreateTask(body)).toThrow(expect.objectContaining({ status: 422 }));
  });

  test(`accepts exactly ${MAX_TASKS_PER_CREATE} tasks in total`, () => {
    // Root + 7 children x 6 grandchildren = 1 + 7 + 42 = 50.
    const body = { title: "Root", subtasks: Array.from({ length: 7 }, (_, i) => ({ title: `c${i}`, subtasks: leaves(6) })) };
    expect(() => validateCreateTask(body)).not.toThrow();
  });

  test(`refuses ${MAX_TASKS_PER_CREATE + 1} tasks in total even when every array is within the breadth cap`, () => {
    // Root + 5 children x 9 grandchildren = 1 + 5 + 45 = 51; no array exceeds 20.
    const body = { title: "Root", subtasks: Array.from({ length: 5 }, (_, i) => ({ title: `c${i}`, subtasks: leaves(9) })) };
    expect(() => validateCreateTask(body)).toThrow(
      expect.objectContaining({
        status: 422,
        details: expect.objectContaining({
          fieldErrors: {
            subtasks: [`A create may contain at most ${MAX_TASKS_PER_CREATE} tasks in total (this one has ${MAX_TASKS_PER_CREATE + 1})`],
          },
        }),
      }),
    );
  });
});

describe("unknown fields are refused, not dropped", () => {
  const unknownKey = (fn: () => unknown, key: string) =>
    expect(fn).toThrow(
      expect.objectContaining({
        status: 422,
        details: expect.objectContaining({ formErrors: [`Unrecognized key(s) in object: '${key}'`] }),
      }),
    );

  test("create: a parentId or a priority on the root is a 422", () => {
    unknownKey(() => validateCreateTask({ title: "Root", parentId: crypto.randomUUID() }), "parentId");
    unknownKey(() => validateCreateTask({ title: "Root", priority: "high" }), "priority");
  });

  test("create: the rule applies inside nested subtasks too", () => {
    expect(() => validateCreateTask({ title: "Root", subtasks: [{ title: "c", id: "x" }] })).toThrow(
      expect.objectContaining({ status: 422 }),
    );
  });

  test("assign: a status or title alongside assigneeId is a 422", () => {
    unknownKey(() => validateUpdateTask({ assigneeId: null, status: "done" }), "status");
    unknownKey(() => validateUpdateTask({ assigneeId: null, title: "renamed" }), "title");
  });

  test("status: an assigneeId alongside status is a 422", () => {
    unknownKey(() => validateUpdateTaskStatus({ status: "done", assigneeId: null }), "assigneeId");
  });
});
