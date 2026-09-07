# Build context is the repo root (see docker-compose.yml): the lockfile and the
# workspace manifests live there. The image only serves; migrations and the
# seed are a separate step (`bun run docker:migrate` at the root), which runs
# the same image with a different command.
FROM oven/bun:1.3
WORKDIR /app

# Workspace manifests plus the files backend's postinstall (prisma generate)
# needs. `--frozen-lockfile` requires every workspace package.json present.
COPY package.json bun.lock ./
COPY backend/package.json backend/prisma.config.ts backend/tsconfig.json ./backend/
COPY backend/db/schema.prisma ./backend/db/
COPY frontend/package.json ./frontend/
# devDependencies stay: `docker:migrate` needs the prisma CLI from this image.
# The postinstall also downloads Prisma's schema engine for `migrate deploy`.
RUN bun install --frozen-lockfile

COPY backend ./backend
WORKDIR /app/backend
RUN bun run db:generate

# Set after install so Bun never treats the install as production-only.
ENV NODE_ENV=production
EXPOSE 4000
# Bun runs TypeScript directly; node_modules are needed at runtime anyway.
CMD ["bun", "src/index.ts"]
