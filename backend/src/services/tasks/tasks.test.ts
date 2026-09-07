import { test, expect } from "bun:test";

import { TaskStatus } from "../../generated/prisma/enums.ts";
import { request, send } from "../../test-utils.ts";
import type { ErrorResponse, TaskListResponse, TaskResponse } from "./tasks.types.ts";

test("GET /api/tasks lists created tasks", async () => {
  const created = (await (await send("/api/tasks", { title: "List me" })).json()) as TaskResponse;

  const res = await request("/api/tasks");
  const body = (await res.json()) as TaskListResponse;

  expect(res.status).toBe(200);
  expect(body.tasks.map((t) => t.id)).toContain(created.task.id);
});

test("POST /api/tasks applies schema defaults", async () => {
  const res = await send("/api/tasks", { title: "Ship it" });
  const { task } = (await res.json()) as TaskResponse;
  expect(res.status).toBe(201);
  expect(task).toMatchObject({
    title: "Ship it",
    status: TaskStatus.todo,
    priority: "medium",
    assignee: null,
    description: null,
  });
});

test("POST /api/tasks rejects an empty title", async () => {
  const res = await send("/api/tasks", { title: "" });
  expect(res.status).toBe(422);
  expect(((await res.json()) as ErrorResponse).error).toBe("Validation failed");
});

test("POST /api/tasks rejects an unknown status", async () => {
  const res = await send("/api/tasks", { title: "Bad status", status: "sideways" });
  expect(res.status).toBe(422);
});

test("GET /api/tasks/:id returns one task", async () => {
  const created = (await (await send("/api/tasks", { title: "Find me" })).json()) as TaskResponse;
  const res = await request(`/api/tasks/${created.task.id}`);
  expect(res.status).toBe(200);
  expect(((await res.json()) as TaskResponse).task.title).toBe("Find me");
});

test("PATCH /api/tasks/:id updates only the given fields", async () => {
  const created = (await (await send("/api/tasks", { title: "Assign me" })).json()) as TaskResponse;

  const res = await send(
    `/api/tasks/${created.task.id}`,
    { assignee: "jared", status: TaskStatus.in_progress },
    "PATCH",
  );
  const { task } = (await res.json()) as TaskResponse;

  expect(res.status).toBe(200);
  expect(task).toMatchObject({ assignee: "jared", status: TaskStatus.in_progress });
  expect(task.title).toBe("Assign me");
});

test("PATCH /api/tasks/:id 404s for an unknown id", async () => {
  const res = await send("/api/tasks/does-not-exist", { title: "x" }, "PATCH");
  expect(res.status).toBe(404);
});

test("DELETE /api/tasks/:id removes a task", async () => {
  const created = (await (await send("/api/tasks", { title: "Delete me" })).json()) as TaskResponse;

  expect((await request(`/api/tasks/${created.task.id}`, { method: "DELETE" })).status).toBe(204);
  expect((await request(`/api/tasks/${created.task.id}`)).status).toBe(404);
});
