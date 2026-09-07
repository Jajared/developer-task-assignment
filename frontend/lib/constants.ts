/**
 * How many levels of subtasks a task may have below it; the root task is
 * depth 0. Mirrors `MAX_SUBTASK_DEPTH` in `backend/src/lib/constants.ts`,
 * which is what actually rejects a deeper tree — this copy only shapes the
 * create form. The types and components recurse without limit; only this
 * number bounds them. Keep the two equal.
 */
export const MAX_SUBTASK_DEPTH = 4;

/**
 * How many direct subtasks one task may have. Mirrors the backend constant of
 * the same name; the form stops offering "Add subtask" at this count.
 */
export const MAX_SUBTASKS_PER_TASK = 20;

/**
 * How many tasks one create may contain in total, root included. Mirrors the
 * backend constant of the same name; the form stops offering "Add subtask"
 * once the tree reaches it.
 */
export const MAX_TASKS_PER_CREATE = 50;
