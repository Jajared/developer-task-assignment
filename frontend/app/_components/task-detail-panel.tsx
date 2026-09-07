"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { UiTask } from "@/lib/mock-data";
import { TaskStatus, type Developer } from "@/lib/types";
import { cn } from "@/lib/utils";

import { DeveloperAvatar } from "./developer-avatar";
import { SidePanel } from "./side-panel";
import { SkillBadge } from "./skill-badge";
import { AssigneeSelect, PrioritySelect, StatusSelect } from "./task-selects";
import { formatDate } from "./task-ui";

type Props = {
  task: UiTask;
  developers: Developer[];
  onUpdate: (id: string, patch: Partial<UiTask>) => void;
  onClose: () => void;
};

const fieldLabel = "text-[13px] text-muted-foreground";

export function TaskDetailPanel({
  task,
  developers,
  onUpdate,
  onClose,
}: Props) {
  const done = task.status === TaskStatus.Done;
  const assignee = developers.find((d) => d.id === task.assigneeId) ?? null;
  const patch = (p: Partial<UiTask>) => onUpdate(task.id, p);

  return (
    <SidePanel
      title={task.title || "Task detail"}
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
      <div className="flex flex-col gap-5 px-6 py-5">
        <Input
          aria-label="Task name"
          value={task.title}
          onChange={(e) => patch({ title: e.target.value })}
          className="-mx-2 h-auto w-[calc(100%+1rem)] border-transparent px-2 py-1.5 text-xl md:text-xl font-bold shadow-none hover:border-border"
        />

        <div className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-3.5">
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
          <PrioritySelect
            value={task.priority}
            onChange={(priority) => patch({ priority })}
            className="justify-self-start"
          />

          <span className={fieldLabel}>Due date</span>
          <Input
            type="date"
            aria-label="Due date"
            value={task.dueDate ?? ""}
            onChange={(e) => patch({ dueDate: e.target.value || null })}
            className="w-fit justify-self-start"
          />

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
          <Textarea
            aria-label="Description"
            rows={6}
            placeholder="Add more detail to this task"
            value={task.description ?? ""}
            onChange={(e) => patch({ description: e.target.value })}
            className="resize-y"
          />
        </div>
      </div>
    </SidePanel>
  );
}
