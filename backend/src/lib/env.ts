/**
 * Runtime configuration. Bun loads .env automatically, so no dotenv here.
 *
 * Every process.env read lives in this file. The schema below is parsed once
 * at import, so a missing or malformed variable fails the boot with a message
 * naming the variable rather than surfacing later as a confusing runtime error.
 */
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Postgres connection string used by the Prisma driver adapter. */
  DATABASE_URL: z.string().trim().min(1, "DATABASE_URL must be a Postgres connection string"),
  /** Origins allowed to call this API from a browser, comma-separated. */
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  /**
   * Google AI Studio key for inferring a task's required skills from its
   * title. Optional: without it, inference is skipped and a task created with
   * no skills simply keeps none.
   */
  GEMINI_API_KEY: z
    .string()
    .trim()
    .transform((value) => value || null)
    .default(""),
  GEMINI_MODEL: z.string().trim().min(1).default("gemini-2.5-flash"),
});

function loadEnv() {
  const result = envSchema.safeParse(process.env);
  if (result.success) return result.data;

  const problems = result.error.issues
    .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${problems}`);
}

const parsed = loadEnv();

export const env = {
  port: parsed.PORT,
  nodeEnv: parsed.NODE_ENV,
  databaseUrl: parsed.DATABASE_URL,
  corsOrigins: parsed.CORS_ORIGINS,
  geminiApiKey: parsed.GEMINI_API_KEY,
  geminiModel: parsed.GEMINI_MODEL,
};
