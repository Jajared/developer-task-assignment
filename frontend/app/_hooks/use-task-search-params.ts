"use client";

import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";

import { STATUSES } from "@/app/_components/task-ui";
import type { TaskStatus } from "@/types";

/** What the list can be narrowed to. Lives in the `?filter=` query param. */
export type Filter = "all" | "unassigned" | TaskStatus;

export const FILTER_VALUES = [
  "all",
  ...STATUSES,
  "unassigned",
] as const satisfies readonly Filter[];

/**
 * The nuqs parsers, kept separate from the hook so a server loader
 * (`createLoader(taskSearchParams)`) can read the same params later.
 */
export const taskSearchParams = {
  filter: parseAsStringLiteral(FILTER_VALUES).withDefault("all"),
  task: parseAsString,
};

/**
 * URL state for the task list, so a view can be linked to or reloaded:
 *
 * - `?filter=in_progress` — the active list filter. `all` is the default and
 *   is dropped from the URL; unknown values fall back to `all`.
 * - `?task=<id>` — the task open in the detail panel, absent when closed.
 *
 * Writes use `history: "replace"` — chip clicks and panel opens should not
 * pile up Back entries.
 */
export function useTaskSearchParams() {
  const [{ filter, task: openTaskId }, setParams] = useQueryStates(
    taskSearchParams,
    { history: "replace" },
  );

  return {
    filter,
    openTaskId,
    setFilter: (filter: Filter) => setParams({ filter }),
    openTask: (id: string) => setParams({ task: id }),
    closeTask: () => setParams({ task: null }),
    /** After a create: reset the filter so the new task is visible, and open it. */
    showNewTask: (id: string) => setParams({ filter: "all", task: id }),
  };
}
