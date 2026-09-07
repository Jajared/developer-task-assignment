import { createApp } from "./app.ts";
import { prisma } from "./db/prisma.ts";
import { env } from "./env.ts";

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`backend listening on http://localhost:${env.port} (${env.nodeEnv})`);
});

// Close the HTTP server and the connection pool so containers stop cleanly.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  });
}
