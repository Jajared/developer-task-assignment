"use client";

import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";

/**
 * The route's error boundary. Any error thrown while rendering the page —
 * including failed queries, which `throwOnError` in `lib/query-client.ts`
 * turns into throws — lands here. Rendered inside the root layout, so the
 * providers are still above it.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const queryClient = useQueryClient();

  const retry = () => {
    // Drop any errored queries so the re-rendered tree fetches afresh rather
    // than re-throwing a cached error.
    queryClient.resetQueries();
    reset();
  };

  return (
    <main className="flex min-h-dvh flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        An unexpected error occurred while loading this page. Try again, and if
        it keeps happening, reload the page.
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-muted-foreground">
          Error ID: {error.digest}
        </p>
      ) : null}
      <Button type="button" onClick={retry}>
        Try again
      </Button>
    </main>
  );
}
