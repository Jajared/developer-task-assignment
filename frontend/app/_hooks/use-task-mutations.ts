"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  createTask,
  describeError,
  updateTask,
  updateTaskStatus,
} from "@/lib/api";
import { taskQueries } from "@/lib/queries";
import type { CreateTaskInput, TaskPatch } from "@/types";

/**
 * The two writes the app makes. Neither touches the cache directly: both
 * invalidate the task list when they settle, so the refetched server rows are
 * the only thing the UI ever renders. A row therefore updates once the server
 * has answered, not on click.
 */
export function useTaskMutations() {
  const queryClient = useQueryClient();
  const listKey = taskQueries.list().queryKey;
  const invalidate = () => queryClient.invalidateQueries({ queryKey: listKey });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaskPatch }) =>
      "status" in input ? updateTaskStatus(id, input) : updateTask(id, input),
    onError: (err) => {
      toast.error("Couldn't save the change.", {
        description: describeError(err),
      });
    },
    onSettled: invalidate,
  });

  const create = useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onError: (err) => {
      toast.error("Couldn't create the task.", {
        description: describeError(err),
      });
    },
    onSettled: invalidate,
  });

  return { update, create };
}
