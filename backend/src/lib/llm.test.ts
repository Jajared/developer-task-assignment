import { describe, expect, test } from "bun:test";
import { z } from "zod/v4";

import { parseStructured, toResponseJsonSchema } from "./llm.ts";

/**
 * The pure half of the LLM module: how a Zod schema becomes Gemini's response
 * schema, and how the model's text is parsed strictly back against it. No
 * network, no key.
 */

const skillPick = z.array(z.enum(["Frontend", "Backend"]));

describe("toResponseJsonSchema", () => {
  test("emits the JSON Schema for the Zod schema without the $schema key Gemini rejects", () => {
    const schema = toResponseJsonSchema(skillPick);
    expect(schema).not.toHaveProperty("$schema");
    expect(schema).toMatchObject({
      type: "array",
      items: { type: "string", enum: ["Frontend", "Backend"] },
    });
  });
});

describe("parseStructured", () => {
  test("returns the parsed value when the text is JSON that satisfies the schema", () => {
    expect(parseStructured(skillPick, '["Backend"]')).toEqual(["Backend"]);
    expect(parseStructured(skillPick, "[]")).toEqual([]);
  });

  test("throws on text that is not JSON", () => {
    expect(() => parseStructured(skillPick, "Backend")).toThrow(SyntaxError);
    expect(() => parseStructured(skillPick, "")).toThrow(SyntaxError);
  });

  test("throws on JSON of the wrong shape", () => {
    expect(() => parseStructured(skillPick, '{"skills":["Backend"]}')).toThrow();
    expect(() => parseStructured(skillPick, '"Backend"')).toThrow();
  });

  test("throws on a value outside the enum — the model may not invent a skill", () => {
    expect(() => parseStructured(skillPick, '["Backend", "DevOps"]')).toThrow();
    // Spelling is exact: the schema is built from the Skill rows as stored.
    expect(() => parseStructured(skillPick, '["backend"]')).toThrow();
  });
});
