import { Badge } from "@/components/ui/badge";
import { TaskStatus, type Developer, type Task } from "@/types";
import { cn } from "@/lib/utils";

import { DeveloperAvatar } from "./developer-avatar";
import { STATUS_LABEL, STATUS_STYLE } from "./task-ui";

type Props = {
  task: Task;
  developers: Developer[];
  /** Open the task in the detail panel. */
  onOpen: (id: string) => void;
};

/**
 * A compact, clickable summary of a task — assignee avatar, title, assignee
 * name and status badge. The detail panel uses it for both the parent task
 * and each subtask so the two read as the same kind of thing.
 */
export function TaskCard({ task, developers, onOpen }: Props) {
  const assignee = developers.find((d) => d.id === task.assigneeId) ?? null;
  const done = task.status === TaskStatus.Done;

  return (
    <button
      type="button"
      onClick={() => onOpen(task.id)}
      className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left hover:bg-muted"
    >
      <DeveloperAvatar developers={developers} developer={assignee} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            "truncate text-sm font-medium",
            done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {assignee ? assignee.name : "Unassigned"}
        </span>
      </span>
      <Badge
        variant="secondary"
        className={cn("shrink-0 border-transparent", STATUS_STYLE[task.status])}
      >
        {STATUS_LABEL[task.status]}
      </Badge>
    </button>
  );
}
