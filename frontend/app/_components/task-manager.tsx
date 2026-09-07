"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { developerQueries, skillQueries, taskQueries } from "@/lib/queries";
import type { CreateTaskInput, TaskPatch, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CreateTaskPanel, type NewTaskInput } from "./create-task-panel";
import { TaskDetailPanel } from "./task-detail-panel";
import { TaskTable } from "./task-table";
import { STATUSES, STATUS_LABEL, ancestorsOf, todayIso } from "./task-ui";
import { describeError, useTaskMutations } from "@/app/_hooks/use-task-mutations";

type Props = {
  /** Server-rendered heading; kept out of the client bundle. */
  heading: React.ReactNode;
  showDescriptions?: boolean;
};

type Filter = "all" | "unassigned" | TaskStatus;

/** The form's tree, mapped to the API body; skills become ids at every level. */
function toCreateInput(input: NewTaskInput): CreateTaskInput {
  return {
    title: input.title,
    description: input.description || null,
    priority: input.priority,
    assigneeId: input.assigneeId,
    requiredSkillIds: input.skills.map((s) => s.id),
    dueDate: input.dueDate,
    subtasks: input.subtasks.map(toCreateInput),
  };
}

function countSubtasks(input: NewTaskInput): number {
  return input.subtasks.reduce((n, s) => n + 1 + countSubtasks(s), 0);
}
type Panel = { kind: "detail"; id: string } | { kind: "create" } | null;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  ...STATUSES.map((s) => ({ value: s as Filter, label: STATUS_LABEL[s] })),
  { value: "unassigned", label: "Unassigned" },
];

/**
 * The one client boundary on the page. Reads tasks, developers and skills
 * from the React Query cache — hydrated by the server prefetch in
 * `app/page.tsx` — and owns the filter and side-panel selection.
 */
export function TaskManager({ heading, showDescriptions = true }: Props) {
  const tasksQuery = useQuery(taskQueries.list());
  const developersQuery = useQuery(developerQueries.list());
  const skillsQuery = useQuery(skillQueries.list());
  const { update, create } = useTaskMutations();

  const [filter, setFilter] = useState<Filter>("all");
  const [panel, setPanel] = useState<Panel>(null);
  // Tasks whose subtasks are shown in the list. Collapsed by default.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  const [today] = useState(todayIso);

  const tasks = tasksQuery.data ?? [];
  const developers = developersQuery.data ?? [];
  const skills = skillsQuery.data ?? [];
  const error = tasksQuery.error ?? developersQuery.error ?? skillsQuery.error;
  const loading =
    tasksQuery.isPending || developersQuery.isPending || skillsQuery.isPending;

  const visible = tasks.filter((t) =>
    filter === "all"
      ? true
      : filter === "unassigned"
        ? !t.assigneeId
        : t.status === filter,
  );
  const unassignedCount = tasks.filter((t) => !t.assigneeId).length;
  const selected =
    panel?.kind === "detail"
      ? (tasks.find((t) => t.id === panel.id) ?? null)
      : null;

  const updateTask = (id: string, patch: TaskPatch) =>
    update.mutate({ id, input: patch });

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  /** Open a task's details and make sure it is visible in the list. */
  const openTask = (id: string) => {
    setPanel({ kind: "detail", id });
    const ancestors = ancestorsOf(tasks, id);
    if (ancestors.some((a) => !expanded.has(a)))
      setExpanded((prev) => new Set([...prev, ...ancestors]));
  };

  const createTask = (input: NewTaskInput) => {
    const subtasks = countSubtasks(input);
    create.mutate(toCreateInput(input), {
      onSuccess: ({ task }) => {
        setFilter("all");
        setPanel({ kind: "detail", id: task.id });
        if (subtasks) setExpanded((prev) => new Set([...prev, task.id]));
        toast.success(
          subtasks
            ? `"${task.title}" created with ${subtasks} subtask${subtasks > 1 ? "s" : ""}.`
            : `"${task.title}" created.`,
          {
            description: task.assignee
              ? `Assigned to ${task.assignee.name}.`
              : "Assign a developer when ready.",
          },
        );
      },
    });
  };

  return (
    <div className="flex h-dvh flex-1 overflow-hidden bg-background text-sm text-foreground">
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="border-b px-8 pt-5 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            {heading}
            <Button
              size="lg"
              disabled={!!error || loading}
              onClick={() => setPanel({ kind: "create" })}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              + Add task
            </Button>
          </div>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-8 py-3">
          <div
            className="flex flex-wrap gap-1.5"
            role="group"
            aria-label="Filter tasks"
          >
            {FILTERS.map((f) => {
              const active = f.value === filter;
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    "h-7.5 rounded-full border px-3 text-[13px] font-medium transition-colors",
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-foreground hover:bg-muted",
                  )}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
          <span className="text-[13px] text-muted-foreground">
            {visible.length} of {tasks.length} tasks · {unassignedCount}{" "}
            unassigned
          </span>
        </div>

        <div className="flex-1 overflow-auto px-8 pb-12">
          {error ? (
            <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-medium">Could not reach the API.</p>
              <p className="mt-1 font-mono text-xs">{describeError(error)}</p>
              <p className="mt-2">
                Start both apps from the repo root with{" "}
                <code className="font-mono">bun dev</code>.
              </p>
            </div>
          ) : loading ? (
            <div className="flex flex-col gap-3 pt-4" aria-busy>
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-11 w-full" />
              ))}
            </div>
          ) : (
            <TaskTable
              tasks={visible}
              allTasks={tasks}
              developers={developers}
              selectedId={selected?.id ?? null}
              today={today}
              showDescriptions={showDescriptions}
              expanded={expanded}
              onToggleExpanded={toggleExpanded}
              onOpen={openTask}
              onUpdate={updateTask}
            />
          )}
        </div>
      </main>

      {selected ? (
        <TaskDetailPanel
          key={selected.id}
          task={selected}
          tasks={tasks}
          developers={developers}
          onUpdate={updateTask}
          onOpen={openTask}
          onClose={() => setPanel(null)}
        />
      ) : null}

      {panel?.kind === "create" ? (
        <CreateTaskPanel
          skills={skills}
          developers={developers}
          onCreate={createTask}
          pending={create.isPending}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </div>
  );
}
