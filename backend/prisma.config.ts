import { defineConfig } from "prisma/config";

// Bun loads .env automatically, so no dotenv import is needed here — run the
// Prisma CLI through the package scripts (`bun run db:migrate`) so it picks
// DATABASE_URL up.
export default defineConfig({
  schema: "db/schema.prisma",
  migrations: {
    path: "db/migrations",
    seed: "bun db/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
