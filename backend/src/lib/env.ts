/**
 * Runtime configuration. Bun loads .env automatically, so no dotenv here.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  nodeEnv: process.env.NODE_ENV ?? "development",
  /** Postgres connection string used by the Prisma driver adapter. */
  databaseUrl: required("DATABASE_URL"),
  /** Origins allowed to call this API from a browser, comma-separated. */
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  /**
   * Google AI Studio key for inferring a task's required skills from its
   * title. Optional: without it, inference is skipped and a task created with
   * no skills simply keeps none.
   */
  geminiApiKey: process.env.GEMINI_API_KEY || null,
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
};
