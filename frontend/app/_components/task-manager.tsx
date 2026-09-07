"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { UiTask } from "@/lib/mock-data";
import { TaskStatus, type Developer, type Skill } from "@/lib/types";
import { cn } from "@/lib/utils";

import { CreateTaskPanel, type NewTaskInput } from "./create-task-panel";
import { TaskDetailPanel } from "./task-detail-panel";
import { TaskTable } from "./task-table";
import { STATUSES, STATUS_LABEL, todayIso } from "./task-ui";

type Props = {
  initialTasks: UiTask[];
  developers: Developer[];
  initialSkills: Skill[];
  /** Server-rendered heading; kept out of the client bundle. */
  heading: React.ReactNode;
  showDescriptions?: boolean;
};

type Filter = "all" | "unassigned" | TaskStatus;
type Panel = { kind: "detail"; id: string } | { kind: "create" } | null;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  ...STATUSES.map((s) => ({ value: s as Filter, label: STATUS_LABEL[s] })),
  { value: "unassigned", label: "Unassigned" },
];

/**
 * The one client boundary on the page: owns task/filter/panel state, since the
 * side panels sit beside the table and both react to the same selection.
 * Everything is in memory for now; wiring `lib/api.ts` in later means
 * replacing the setState calls in the handlers.
 */
export function TaskManager({
  initialTasks,
  developers,
  initialSkills,
  heading,
  showDescriptions = true,
}: Props) {
  const [tasks, setTasks] = useState(initialTasks);
  const [skills, setSkills] = useState(initialSkills);
  const [filter, setFilter] = useState<Filter>("all");
  const [panel, setPanel] = useState<Panel>(null);
  const [today] = useState(todayIso);

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

  const updateTask = (id: string, patch: Partial<UiTask>) => {
    const updatedAt = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...patch, updatedAt } : t)),
    );
  };

  const addSkill = (name: string): Skill => {
    const stamp = new Date().toISOString();
    const skill: Skill = {
      id: `local-${crypto.randomUUID()}`,
      name,
      createdAt: stamp,
      updatedAt: stamp,
    };
    setSkills((prev) => [...prev, skill]);
    return skill;
  };

  const createTask = (input: NewTaskInput) => {
    const stamp = new Date().toISOString();
    const task: UiTask = {
      id: `local-${crypto.randomUUID()}`,
      title: input.title,
      description: input.description || null,
      status: TaskStatus.Todo,
      priority: input.priority,
      assigneeId: input.assigneeId,
      createdAt: stamp,
      updatedAt: stamp,
      requiredSkills: input.skills,
      dueDate: input.dueDate,
    };
    setTasks((prev) => [task, ...prev]);
    setFilter("all");
    setPanel({ kind: "detail", id: task.id });
    const assignee = developers.find((d) => d.id === input.assigneeId);
    toast.success(`"${task.title}" created.`, {
      description: assignee
        ? `Assigned to ${assignee.name}.`
        : "Assign a developer when ready.",
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
          <TaskTable
            tasks={visible}
            developers={developers}
            selectedId={selected?.id ?? null}
            today={today}
            showDescriptions={showDescriptions}
            onOpen={(id) => setPanel({ kind: "detail", id })}
            onUpdate={updateTask}
          />
        </div>
      </main>

      {selected ? (
        <TaskDetailPanel
          key={selected.id}
          task={selected}
          developers={developers}
          onUpdate={updateTask}
          onClose={() => setPanel(null)}
        />
      ) : null}

      {panel?.kind === "create" ? (
        <CreateTaskPanel
          skills={skills}
          developers={developers}
          onAddSkill={addSkill}
          onCreate={createTask}
          onClose={() => setPanel(null)}
        />
      ) : null}
    </div>
  );
}
