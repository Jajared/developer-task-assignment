/**
 * The API contract as the frontend sees it. These mirror the backend's
 * `tasks.types.ts`, `developers.types.ts` and `skills.types.ts`, which are
 * derived from the Prisma schema — keep them in step when the schema changes.
 */

export const TaskStatus = {
  Todo: "todo",
  InProgress: "in_progress",
  Done: "done",
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskPriority = {
  Low: "low",
  Medium: "medium",
  High: "high",
} as const;

export type TaskPriority = (typeof TaskPriority)[keyof typeof TaskPriority];

export type Skill = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type Developer = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Skills the developer holds — this is what makes them eligible for a task. */
  skills: Skill[];
};

export type Task = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Developer the task is assigned to, or null while unassigned. Nested
   * relations come back as whole rows, so this has no `skills` of its own.
   */
  assignee: Omit<Developer, "skills"> | null;
  /** Skills a developer must have to be assigned this task. */
  requiredSkills: Skill[];
};

/**
 * Relations are written by id. The server rejects an assignee who doesn't hold
 * every required skill, so these two fields can't be chosen independently.
 */
export type CreateTaskInput = {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string | null;
  requiredSkillIds?: string[];
};

export type UpdateTaskInput = Partial<CreateTaskInput>;

/** Body for `PATCH /api/tasks/:id/status`. */
export type UpdateTaskStatusInput = { status: TaskStatus };

// Response envelopes
export type TaskListResponse = { tasks: Task[] };
export type TaskResponse = { task: Task };
export type DeveloperListResponse = { developers: Developer[] };
export type DeveloperResponse = { developer: Developer };
export type SkillListResponse = { skills: Skill[] };
export type SkillResponse = { skill: Skill };
export type ErrorResponse = { error: string; details?: unknown };

/**
 * A `409` from an assign or a required-skills change: the developer is missing
 * skills the task requires. Only ids and names are reported.
 */
export type MissingSkillsError = ErrorResponse & {
  details: { missingSkills: { id: string; name: string }[] };
};
