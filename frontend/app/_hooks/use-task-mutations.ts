"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ApiError, createTask, updateTask, updateTaskStatus } from "@/lib/api";
import { taskQueries } from "@/lib/queries";
import type {
  CreateTaskInput,
  MissingSkillsError,
  Task,
  TaskPatch,
  UnfinishedSubtasksError,
} from "@/lib/types";

/** Turn an API failure into a sentence for a toast. */
export function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 409) {
      const details = err.details as
        | Partial<MissingSkillsError["details"]>
        | Partial<UnfinishedSubtasksError["details"]>
        | undefined;
      const missing =
        details && "missingSkills" in details ? details.missingSkills : undefined;
      if (missing?.length) {
        return `${err.message}: ${missing.map((s) => s.name).join(", ")}.`;
      }
      const open =
        details && "unfinishedSubtasks" in details
          ? details.unfinishedSubtasks
          : undefined;
      if (open?.length) {
        return `${err.message}: ${open.map((s) => s.title).join(", ")}.`;
      }
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong.";
}

/** Apply a patch to a cached task so the UI can show it before the server answers. */
function applyOptimistic(task: Task, patch: TaskPatch): Task {
  if ("status" in patch) return { ...task, status: patch.status };
  // The assignee row lags one round-trip behind; nothing renders it directly.
  return {
    ...task,
    assigneeId: patch.assigneeId,
    assignee: patch.assigneeId ? task.assignee : null,
  };
}

export function useTaskMutations() {
  const queryClient = useQueryClient();
  const listKey = taskQueries.list().queryKey;

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaskPatch }) =>
      "status" in input ? updateTaskStatus(id, input) : updateTask(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData(listKey);
      queryClient.setQueryData(listKey, (old) =>
        old?.map((t) => (t.id === id ? applyOptimistic(t, input) : t)),
      );
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous)
        queryClient.setQueryData(listKey, context.previous);
      toast.error("Couldn't save the change.", {
        description: describeError(err),
      });
    },
    onSuccess: ({ task }) => {
      queryClient.setQueryData(listKey, (old) =>
        old?.map((t) => (t.id === task.id ? task : t)),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });

  const create = useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: ({ task }) => {
      queryClient.setQueryData(listKey, (old) => [task, ...(old ?? [])]);
    },
    onError: (err) => {
      toast.error("Couldn't create the task.", {
        description: describeError(err),
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });

  return { update, create };
}
