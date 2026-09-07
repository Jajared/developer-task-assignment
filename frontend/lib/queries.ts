import { queryOptions } from "@tanstack/react-query";

import { listDevelopers, listSkills, listTasks } from "./api";

/**
 * Query definitions shared by the server prefetch in `app/page.tsx` and the
 * client hooks, so both sides agree on keys and fetchers.
 */
export const taskQueries = {
  all: () => ["tasks"] as const,
  list: () =>
    queryOptions({
      queryKey: [...taskQueries.all(), "list"] as const,
      queryFn: async () => (await listTasks()).tasks,
    }),
};

export const developerQueries = {
  list: () =>
    queryOptions({
      queryKey: ["developers", "list"] as const,
      queryFn: async () => (await listDevelopers()).developers,
    }),
};

export const skillQueries = {
  list: () =>
    queryOptions({
      queryKey: ["skills", "list"] as const,
      queryFn: async () => (await listSkills()).skills,
    }),
};
