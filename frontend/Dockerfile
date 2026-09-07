# Build context is the repo root (see docker-compose.yml).
#
# Stage 1 installs the workspace with Bun (the lockfile is Bun's) and runs
# `next build` under Node: Bun 1.3 segfaults running the Next 16 build inside
# a Linux container. Stage 2 runs Next's standalone output under the same Node.
FROM node:22-slim AS builder
COPY --from=oven/bun:1.3 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

# `--frozen-lockfile` needs every workspace package.json; backend's postinstall
# (prisma generate) needs its config and schema to succeed.
COPY package.json bun.lock ./
COPY backend/package.json backend/prisma.config.ts ./backend/
COPY backend/db/schema.prisma ./backend/db/
COPY frontend/package.json ./frontend/
RUN bun install --frozen-lockfile

COPY frontend ./frontend

# NEXT_PUBLIC_* is inlined at build time: this is the URL the *browser* uses.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
# Needs network: layout.tsx loads Geist via next/font/google.
RUN cd frontend && ./node_modules/.bin/next build

FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

# Standalone output mirrors the monorepo layout: server.js sits under frontend/.
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder /app/frontend/public ./frontend/public

EXPOSE 3000
CMD ["node", "frontend/server.js"]
