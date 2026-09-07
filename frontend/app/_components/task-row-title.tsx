"use client";

import { ChevronRightIcon, CornerDownRightIcon } from "lucide-react";

import type { Task } from "@/types";
import { cn } from "@/lib/utils";

type Props = {
  task: Task;
  /** Nesting depth from `flattenTree`; multiplied by `indent` for padding. */
  depth: number;
  /** Pixels of left padding per depth level. `0` when the container indents itself. */
  indent?: number;
  childCount: number;
  isExpanded: boolean;
  done: boolean;
  showDescriptions?: boolean;
  /** Extra classes on the description, e.g. `truncate` vs `line-clamp-2`. */
  descriptionClassName?: string;
  onToggleExpanded: (id: string) => void;
  onOpen: (id: string) => void;
};

/**
 * The leading part of a task row, shared by the desktop table and the mobile
 * card list: the subtask expander (or the subtask marker), then the title and
 * description as a button that opens the task.
 */
export function TaskRowTitle({
  task,
  depth,
  indent = 20,
  childCount,
  isExpanded,
  done,
  showDescriptions = true,
  descriptionClassName = "max-w-[44ch] truncate",
  onToggleExpanded,
  onOpen,
}: Props) {
  const pad = depth * indent;
  return (
    <div
      className="flex items-start gap-1"
      style={pad ? { paddingLeft: pad } : undefined}
    >
      {childCount > 0 ? (
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-label={`${isExpanded ? "Hide" : "Show"} ${childCount} subtask${childCount > 1 ? "s" : ""}`}
          onClick={() => onToggleExpanded(task.id)}
          className="-ml-1 flex h-5 min-w-7 shrink-0 items-center gap-0.5 rounded px-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground md:min-w-0"
        >
          <ChevronRightIcon
            className={cn(
              "size-3.5 transition-transform",
              isExpanded && "rotate-90",
            )}
          />
          {childCount}
        </button>
      ) : depth > 0 ? (
        <CornerDownRightIcon
          aria-label="Subtask"
          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
        />
      ) : null}
      <button
        type="button"
        onClick={() => onOpen(task.id)}
        className="flex min-w-0 flex-1 text-left outline-none focus-visible:underline"
      >
        <span className="min-w-0">
          <div
            className={cn(
              "text-sm font-medium",
              done ? "text-muted-foreground line-through" : "text-foreground",
            )}
          >
            {task.title}
          </div>
          {showDescriptions && task.description ? (
            <div
              className={cn(
                "mt-px text-xs text-muted-foreground",
                descriptionClassName,
              )}
            >
              {task.description}
            </div>
          ) : null}
        </span>
      </button>
    </div>
  );
}
