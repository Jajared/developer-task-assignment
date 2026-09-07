import {
  QueryClient,
  defaultShouldDehydrateQuery,
  isServer,
} from "@tanstack/react-query";

/**
 * One QueryClient per request on the server, one per browser session on the
 * client — the split TanStack's SSR guide prescribes, so server-side caches
 * are never shared between users.
 */
function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Above zero so a query hydrated from the server isn't refetched the
        // instant the client mounts.
        staleTime: 60 * 1000,
      },
      dehydrate: {
        // Ship pending queries too, so a server prefetch that hasn't settled
        // still streams through to the client.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (isServer) return makeQueryClient();
  // Reuse on the client, or React suspending during first render would throw
  // the cache away and start again.
  browserQueryClient ??= makeQueryClient();
  return browserQueryClient;
}
