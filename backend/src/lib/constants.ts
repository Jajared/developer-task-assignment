/**
 * How many levels of subtasks a task may have below it. The root task is
 * depth 0, so 4 allows root → sub → sub → sub → sub and refuses a fifth.
 *
 * The schema and the create path are recursive with no built-in limit; this
 * constant is the only thing that bounds nesting. The frontend keeps a copy
 * in `frontend/lib/constants.ts` to shape the form — keep the two equal.
 */
export const MAX_SUBTASK_DEPTH = 4;
