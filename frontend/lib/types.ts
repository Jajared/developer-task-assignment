/**
 * The API contract as the frontend sees it. The backend declares no response
 * types — a row's columns are the response, and the shape is whatever the
 * service's Prisma query returns — so this file is derived by hand from
 * `backend/db/schema.prisma`. Keep it in step when the schema changes.
 */

export const TaskStatus = {
  Todo: "todo",
  InProgress: "in_progress",
  Done: "done",
} as const;

export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

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
  assigneeId: string | null;
  /**
   * The task this one is a subtask of, or null for a top-level task. The list
   * is flat — subtasks are ordinary rows — so the tree is built client-side
   * (see `flattenTree` in `app/_components/task-ui.ts`).
   */
  parentId: string | null;
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
  assigneeId?: string | null;
  /**
   * Omitted or empty means "not specified": the server then infers the
   * required skills from the title with an LLM and the created row comes back
   * with them attached. Applies to every subtask independently.
   */
  requiredSkillIds?: string[];
  /**
   * Subtasks to create under this task, each the same shape with its own
   * `subtasks` — nesting is unbounded. The whole tree is written in one
   * transaction; this is the only way a subtask is created.
   */
  subtasks?: CreateTaskInput[];
};

/**
 * Body for `PATCH /api/tasks/:id`. Assignment is all that route changes; null
 * unassigns. A task's other fields are fixed at creation.
 */
export type UpdateTaskInput = { assigneeId: string | null };

/** Body for `PATCH /api/tasks/:id/status`. */
export type UpdateTaskStatusInput = { status: TaskStatus };

/** The two things a task can change after creation. */
export type TaskPatch = UpdateTaskInput | UpdateTaskStatusInput;

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

/**
 * A `409` from the status route or a create: the task was to be `done` while a
 * direct subtask was still open. On the create path the rows don't exist yet,
 * so `id` is absent there.
 */
export type UnfinishedSubtasksError = ErrorResponse & {
  details: {
    unfinishedSubtasks: { id?: string; title: string; status: TaskStatus }[];
  };
};
