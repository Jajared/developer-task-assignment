import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client.ts";
import { env } from "@/lib/env.ts";
import { logger } from "@/lib/log.ts";

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

  const client = new PrismaClient({
    adapter,
    log: [
      { level: "warn", emit: "event" },
      { level: "error", emit: "event" },
    ],
  });

  // Prisma's own warnings and errors go through the app logger, so they share
  // its format and level threshold instead of landing on stdout unformatted.
  client.$on("warn", (event) => logger.warn(event.message, { source: "prisma", target: event.target }));
  client.$on("error", (event) => logger.error(event.message, { source: "prisma", target: event.target }));

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (env.nodeEnv !== "production") {
  globalForPrisma.prisma = prisma;
}
