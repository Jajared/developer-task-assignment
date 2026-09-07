/**
 * How many levels of subtasks a task may have below it. The root task is
 * depth 0, so 4 allows root → sub → sub → sub → sub and refuses a fifth.
 *
 * The schema and the create path are recursive with no built-in limit; this
 * constant is the only thing that bounds nesting. The frontend keeps a copy
 * in `frontend/lib/constants.ts` to shape the form — keep the two equal.
 */
export const MAX_SUBTASK_DEPTH = 4;

/**
 * How many direct subtasks one task may have in a create body. Enforced by
 * the validator on every `subtasks` array. Mirrored in the frontend.
 */
export const MAX_SUBTASKS_PER_TASK = 20;

/**
 * How many tasks one create request may write in total — the root plus every
 * subtask at any depth. Depth and breadth alone still allow thousands of
 * nodes in a 100kb body, and each skill-less node costs an LLM call and a row
 * in one transaction, so the validator refuses trees above this size before
 * any of that work starts. Mirrored in the frontend.
 */
export const MAX_TASKS_PER_CREATE = 50;
