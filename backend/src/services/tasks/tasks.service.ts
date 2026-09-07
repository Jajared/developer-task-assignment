import { prisma } from "../../db/prisma.ts";
import type { CreateTaskBody, UpdateTaskBody } from "./tasks.validator.ts";
import type { Task, TaskRow } from "./tasks.types.ts";

/**
 * Maps a database row to the API shape. Keeps Prisma types out of the
 * response and turns `Date` columns into ISO strings.
 */
function toDto(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignee: row.assignee,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * The id column is a Postgres `uuid`, which rejects malformed input at the
 * database level. Screening here turns a bad path param into a clean 404
 * instead of a 500.
 */
function asId(id: string | undefined): string | undefined {
  return id && UUID_PATTERN.test(id) ? id : undefined;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when Prisma failed because `where` matched no row. */
function isRecordNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "P2025";
}

/**
 * Business logic and persistence for tasks, backed by Prisma.
 */
export const taskService = {
  async list(): Promise<Task[]> {
    const rows = await prisma.task.findMany({ orderBy: { createdAt: "desc" } });
    return rows.map(toDto);
  },

  async findById(rawId: string | undefined): Promise<Task | undefined> {
    const id = asId(rawId);
    if (!id) return undefined;

    const row = await prisma.task.findUnique({ where: { id } });
    return row ? toDto(row) : undefined;
  },

  async create(data: CreateTaskBody): Promise<Task> {
    const row = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description ?? null,
        status: data.status,
        priority: data.priority,
        assignee: data.assignee ?? null,
      },
    });
    return toDto(row);
  },

  async update(rawId: string | undefined, data: UpdateTaskBody): Promise<Task | undefined> {
    const id = asId(rawId);
    if (!id) return undefined;

    try {
      // `undefined` tells Prisma to leave a column alone, so a partial body
      // maps straight onto the update — but an explicit null must still clear it.
      const row = await prisma.task.update({
        where: { id },
        data: {
          title: data.title,
          description: data.description === undefined ? undefined : (data.description ?? null),
          status: data.status,
          priority: data.priority,
          assignee: data.assignee === undefined ? undefined : (data.assignee ?? null),
        },
      });
      return toDto(row);
    } catch (err) {
      // P2025: no row matched `where`. Any other failure is a real error.
      if (isRecordNotFound(err)) return undefined;
      throw err;
    }
  },

  async remove(rawId: string | undefined): Promise<boolean> {
    const id = asId(rawId);
    if (!id) return false;

    const { count } = await prisma.task.deleteMany({ where: { id } });
    return count > 0;
  },
};
