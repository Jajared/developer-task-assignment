/**
 * How many levels of subtasks a task may have below it; the root task is
 * depth 0. Mirrors `MAX_SUBTASK_DEPTH` in `backend/src/lib/constants.ts`,
 * which is what actually rejects a deeper tree — this copy only shapes the
 * create form. The types and components recurse without limit; only this
 * number bounds them. Keep the two equal.
 */
export const MAX_SUBTASK_DEPTH = 4;
