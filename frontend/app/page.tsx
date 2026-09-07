import { Suspense } from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";

import { BacklogHeading } from "@/app/_components/backlog-heading";
import { TaskManager } from "@/app/_components/task-manager";
import { developerQueries, skillQueries, taskQueries } from "@/lib/queries";
import { getQueryClient } from "@/lib/query-client";

/**
 * Server component. Prefetches everything the page needs from the API into a
 * request-scoped QueryClient and hands the dehydrated cache to the client
 * shell, so the first paint is server-rendered with real data and the client
 * hooks pick up without a second fetch.
 *
 * `prefetchQuery` swallows failures on purpose: if the API is down the query
 * is simply absent from the cache, the client retries, and `TaskManager`
 * renders its error panel instead of the route crashing.
 *
 * `TaskManager` reads the URL through nuqs (`useSearchParams` underneath),
 * which Next requires to sit under a `Suspense` boundary for the build-time
 * prerender. The route is dynamic, so the fallback never shows in practice.
 */
export default async function Home() {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(taskQueries.list()),
    queryClient.prefetchQuery(developerQueries.list()),
    queryClient.prefetchQuery(skillQueries.list()),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Suspense>
        <TaskManager heading={<BacklogHeading />} />
      </Suspense>
    </HydrationBoundary>
  );
}
