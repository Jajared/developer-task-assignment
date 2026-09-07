import { createApp } from "@/app.ts";
import { prisma } from "@/db/prisma.ts";
import { env } from "@/lib/env.ts";
import { logger } from "@/lib/log.ts";

const server = createApp().listen(env.port, () => {
  logger.info(`Listening on http://localhost:${env.port}`, {
    port: env.port,
    nodeEnv: env.nodeEnv,
    logLevel: env.logLevel,
  });
});

// Close the HTTP server and the connection pool so containers stop cleanly.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info(`Received ${signal}, shutting down`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info("Shutdown complete");
      process.exit(0);
    });
  });
}
