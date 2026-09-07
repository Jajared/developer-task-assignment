import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client.ts";
import { env } from "@/lib/env.ts";

/**
 * One Prisma client for the process. Prisma 7 talks to Postgres through a
 * driver adapter, so the connection string is passed here rather than read
 * from the schema.
 *
 * Cached on globalThis so `bun --watch` reloads don't leak a connection pool
 * on every file change.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: env.databaseUrl });

  return new PrismaClient({
    adapter,
    log: env.nodeEnv === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.nodeEnv !== "production") {
  globalForPrisma.prisma = prisma;
}
