"use client";

import { CornerDownRightIcon, CornerLeftUpIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TaskStatus,
  type Developer,
  type Task,
  type TaskPatch,
} from "@/lib/types";
import { cn } from "@/lib/utils";

import { DeveloperAvatar } from "./developer-avatar";
import { SidePanel } from "@/components/ui/side-panel";
import { SkillBadge } from "./skill-badge";
import { AssigneeSelect, StatusSelect } from "./task-selects";
import {
  PRIORITY_LABEL,
  PRIORITY_STYLE,
  STATUS_LABEL,
  STATUS_STYLE,
  childrenOf,
  formatDate,
  hasUnfinishedSubtasks,
} from "./task-ui";

type Props = {
  task: Task;
  /** Every task — needed to find this one's parent and subtasks. */
  tasks: Task[];
  developers: Developer[];
  onUpdate: (id: string, patch: TaskPatch) => void;
  /** Open another task in this panel (its parent or one of its subtasks). */
  onOpen: (id: string) => void;
  onClose: () => void;
};

const fieldLabel = "text-[13px] text-muted-foreground";

/**
 * After creation only two things about a task can change — who holds it and
 * its status — so those are the only controls here. Everything else is shown
 * read-only, including where the task sits in its tree: its parent, if any,
 * and its direct subtasks, each a link that opens that task here instead.
 */
export function TaskDetailPanel({
  task,
  tasks,
  developers,
  onUpdate,
  onOpen,
  onClose,
}: Props) {
  const done = task.status === TaskStatus.Done;
  const assignee = developers.find((d) => d.id === task.assigneeId) ?? null;
  const parent = task.parentId
    ? (tasks.find((t) => t.id === task.parentId) ?? null)
    : null;
  const subtasks = childrenOf(tasks, task.id);
  const blocked = !done && hasUnfinishedSubtasks(task, tasks);
  const patch = (p: TaskPatch) => onUpdate(task.id, p);

  const completeButton = (
    <Button
      variant="outline"
      size="default"
      aria-pressed={done}
      disabled={blocked}
      onClick={() => patch({ status: done ? TaskStatus.Todo : TaskStatus.Done })}
      className={cn(
        done &&
          "border-emerald-100 bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
      )}
    >
      <span className="inline-block size-3.5 rounded-full border-[1.5px] border-current" />
      {done ? "Completed" : "Mark complete"}
    </Button>
  );

  return (
    <SidePanel
      title={task.title}
      onClose={onClose}
      header={
        blocked ? (
          <Tooltip>
            {/* A disabled button emits no pointer events; the span carries them. */}
            <TooltipTrigger asChild>
              <span tabIndex={0}>{completeButton}</span>
            </TooltipTrigger>
            <TooltipContent>Finish all subtasks first.</TooltipContent>
          </Tooltip>
        ) : (
          completeButton
        )
      }
    >
      <div className="flex flex-col gap-7 px-6 py-6">
        <div className="flex flex-col gap-2">
          {parent ? (
            <button
              type="button"
              onClick={() => onOpen(parent.id)}
              className="flex min-w-0 items-center gap-1.5 self-start text-[13px] text-muted-foreground hover:text-foreground hover:underline"
            >
              <CornerLeftUpIcon className="size-3.5 shrink-0" />
              <span className="truncate">Subtask of {parent.title}</span>
            </button>
          ) : null}
          <h2
            className={cn(
              "text-xl font-bold",
              done && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </h2>
        </div>

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
            doneDisabled={blocked}
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

        {subtasks.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] font-semibold">Subtasks</span>
              <span className="text-xs text-muted-foreground">
                {subtasks.filter((t) => t.status === TaskStatus.Done).length}{" "}
                of {subtasks.length} done
              </span>
            </div>
            <ul className="flex flex-col divide-y rounded-lg border">
              {subtasks.map((sub) => {
                const subDone = sub.status === TaskStatus.Done;
                return (
                  <li key={sub.id}>
                    <button
                      type="button"
                      onClick={() => onOpen(sub.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted"
                    >
                      <CornerDownRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate text-sm",
                          subDone && "text-muted-foreground line-through",
                        )}
                      >
                        {sub.title}
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "shrink-0 border-transparent",
                          STATUS_STYLE[sub.status],
                        )}
                      >
                        {STATUS_LABEL[sub.status]}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </SidePanel>
  );
}
