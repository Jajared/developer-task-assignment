"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TaskStatus,
  type Developer,
  type Task,
  type TaskPatch,
} from "@/lib/types";
import { cn } from "@/lib/utils";

import { DeveloperAvatar } from "./developer-avatar";
import { SidePanel } from "./side-panel";
import { SkillBadge } from "./skill-badge";
import { AssigneeSelect, StatusSelect } from "./task-selects";
import { PRIORITY_LABEL, PRIORITY_STYLE, formatDate } from "./task-ui";

type Props = {
  task: Task;
  developers: Developer[];
  onUpdate: (id: string, patch: TaskPatch) => void;
  onClose: () => void;
};

const fieldLabel = "text-[13px] text-muted-foreground";

/**
 * After creation only two things about a task can change — who holds it and
 * its status — so those are the only controls here. Everything else is shown
 * read-only.
 */
export function TaskDetailPanel({
  task,
  developers,
  onUpdate,
  onClose,
}: Props) {
  const done = task.status === TaskStatus.Done;
  const assignee = developers.find((d) => d.id === task.assigneeId) ?? null;
  const patch = (p: TaskPatch) => onUpdate(task.id, p);

  return (
    <SidePanel
      title={task.title}
      onClose={onClose}
      header={
        <Button
          variant="outline"
          size="default"
          aria-pressed={done}
          onClick={() =>
            patch({ status: done ? TaskStatus.Todo : TaskStatus.Done })
          }
          className={cn(
            done &&
              "border-emerald-100 bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
          )}
        >
          <span className="inline-block size-3.5 rounded-full border-[1.5px] border-current" />
          {done ? "Completed" : "Mark complete"}
        </Button>
      }
    >
      <div className="flex flex-col gap-7 px-6 py-6">
        <h2
          className={cn(
            "text-xl font-bold",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </h2>

        <div className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-5">
          <span className={fieldLabel}>Assignee</span>
          <div className="flex items-center gap-2">
            <DeveloperAvatar developers={developers} developer={assignee} />
            <AssigneeSelect
              developers={developers}
              requiredSkills={task.requiredSkills}
              value={task.assigneeId}
              onChange={(assigneeId) => patch({ assigneeId })}
              className="flex-1"
            />
          </div>

          <span className={fieldLabel}>Status</span>
          <StatusSelect
            value={task.status}
            onChange={(status) => patch({ status })}
            className="justify-self-start"
          />

          <span className={fieldLabel}>Priority</span>
          <Badge
            variant="secondary"
            className={cn("border-transparent", PRIORITY_STYLE[task.priority])}
          >
            {PRIORITY_LABEL[task.priority]}
          </Badge>

          <span className={fieldLabel}>Due date</span>
          <span className="text-[13px]">{formatDate(task.dueDate)}</span>

          <span className={fieldLabel}>Created</span>
          <span className="text-[13px]">{formatDate(task.createdAt)}</span>

          <span className={cn(fieldLabel, "self-start pt-1")}>Skills</span>
          <div className="flex flex-wrap gap-1.5">
            {task.requiredSkills.map((s) => (
              <SkillBadge key={s.id} name={s.name} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Description</span>
          <p
            className={cn(
              "text-sm whitespace-pre-wrap",
              !task.description && "text-muted-foreground",
            )}
          >
            {task.description || "No description."}
          </p>
        </div>
      </div>
    </SidePanel>
  );
}
