import { test, expect } from "bun:test";

import { request } from "./test-utils.ts";

test("GET /health reports ok with an uptime", async () => {
  const res = await request("/health");
  const body = (await res.json()) as { status: string; uptime: number };
  expect(res.status).toBe(200);
  expect(body.status).toBe("ok");
  expect(body.uptime).toBeGreaterThan(0);
});

test("unknown routes 404 as JSON", async () => {
  const res = await request("/nope");
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: "Not found" });
});
