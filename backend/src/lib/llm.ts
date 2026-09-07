import { GoogleGenAI } from "@google/genai";
import { z as z4, type z } from "zod/v4";

import { env } from "./env.ts";
import { getLogger, logger } from "./log.ts";

/**
 * The one place the app talks to an LLM. Knows Gemini and Zod; knows nothing
 * about tasks or skills — that's a service's business.
 *
 * `generateStructured()` is the whole API: hand it a Zod schema and a prompt,
 * get back a value of that schema's type. The schema is used twice — its JSON
 * Schema is sent as Gemini's `responseJsonSchema`, so decoding is constrained
 * to the shape, and the reply is then parsed *strictly* against the same Zod
 * schema, so anything off-shape is rejected rather than tolerated.
 *
 * `zod/v4` ships inside the installed zod 3.25 package and is what provides
 * `z.toJSONSchema`; the request validators elsewhere stay on the v3 API.
 */

const TIMEOUT_MS = 10_000;

let client: GoogleGenAI | null = null;
let warnedNoKey = false;

/** True when a key is configured. Callers use it to skip work, not to guard the call. */
export function isLlmConfigured(): boolean {
  if (env.geminiApiKey) return true;
  if (!warnedNoKey) {
    logger.warn("GEMINI_API_KEY is not set — LLM features are disabled");
    warnedNoKey = true;
  }
  return false;
}

function getClient(): GoogleGenAI {
  if (!env.geminiApiKey) throw new Error("GEMINI_API_KEY is not set");
  client ??= new GoogleGenAI({ apiKey: env.geminiApiKey });
  return client;
}

/** A Zod schema as the JSON Schema Gemini accepts. `$schema` is dropped — Gemini rejects it. */
export function toResponseJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema: _, ...jsonSchema } = z4.toJSONSchema(schema);
  return jsonSchema;
}

/**
 * Parses raw model text as JSON and validates it against `schema`. Throws
 * (SyntaxError or ZodError) on anything off-shape. Pure — the unit test's target.
 */
export function parseStructured<T>(schema: z.ZodType<T>, text: string): T {
  return schema.parse(JSON.parse(text));
}

/**
 * One structured-output call. Throws on a missing key, a transport or quota
 * error, a timeout, or a reply that doesn't satisfy `schema`; the caller
 * decides what a failure means for its feature.
 */
export async function generateStructured<T>(args: {
  schema: z.ZodType<T>;
  systemInstruction: string;
  prompt: string;
}): Promise<T> {
  const startedAt = performance.now();
  const response = await getClient().models.generateContent({
    model: env.geminiModel,
    contents: args.prompt,
    config: {
      systemInstruction: args.systemInstruction,
      responseMimeType: "application/json",
      responseJsonSchema: toResponseJsonSchema(args.schema),
      temperature: 0,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    },
  });
  getLogger().debug("LLM call completed", {
    model: env.geminiModel,
    durationMs: Math.round(performance.now() - startedAt),
    usage: response.usageMetadata
      ? { input: response.usageMetadata.promptTokenCount, output: response.usageMetadata.candidatesTokenCount }
      : undefined,
  });
  return parseStructured(args.schema, response.text ?? "");
}
