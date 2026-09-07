"use client";

import {
  TaskStatus,
  type Developer,
  type Task,
  type TaskPatch,
} from "@/lib/types";
import { cn } from "@/lib/utils";

import { DeveloperAvatar } from "./developer-avatar";
import { SkillBadge } from "./skill-badge";
import { TaskRowTitle } from "./task-row-title";
import { AssigneeSelect, StatusSelect } from "./task-selects";
import { flattenTree, hasUnfinishedSubtasks } from "./task-ui";

type Props = {
  /** The rows to show, already filtered. Rendered as a tree via `parentId`. */
  tasks: Task[];
  /** Every task, filtered or not — the Done rule is judged against all subtasks. */
  allTasks: Task[];
  developers: Developer[];
  selectedId: string | null;
  showDescriptions?: boolean;
  /** Tasks whose subtasks are shown; everything else is collapsed. */
  expanded: ReadonlySet<string>;
  onToggleExpanded: (id: string) => void;
  onOpen: (id: string) => void;
  onUpdate: (id: string, patch: TaskPatch) => void;
};

/** Indent per nesting level; tighter than the table's so depth 4 still fits a phone. */
const INDENT = 12;

/**
 * The task list for small screens: the same flattened tree as `TaskTable`,
 * but one stacked card per task — title, skills, then the assignee and status
 * controls on a row. Shown below `md`; the table takes over above it.
 */
export function TaskCards({
  tasks,
  allTasks,
  developers,
  selectedId,
  showDescriptions = true,
  expanded,
  onToggleExpanded,
  onOpen,
  onUpdate,
}: Props) {
  if (tasks.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No tasks match this filter.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2 pt-3">
      {flattenTree(tasks, expanded).map(({ task, depth, childCount }) => {
        const done = task.status === TaskStatus.Done;
        const blocked = hasUnfinishedSubtasks(task, allTasks);
        const assignee =
          developers.find((d) => d.id === task.assigneeId) ?? null;
        const selected = task.id === selectedId;
        return (
          <li
            key={task.id}
            className={cn(
              "flex flex-col gap-2.5 rounded-lg border bg-background p-3",
              selected && "border-primary/40 bg-primary/5",
            )}
            style={depth ? { marginLeft: depth * INDENT } : undefined}
          >
            <TaskRowTitle
              task={task}
              depth={depth}
              indent={0}
              childCount={childCount}
              isExpanded={expanded.has(task.id)}
              done={done}
              showDescriptions={showDescriptions}
              descriptionClassName="line-clamp-2"
              onToggleExpanded={onToggleExpanded}
              onOpen={onOpen}
            />

            {task.requiredSkills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {task.requiredSkills.map((s) => (
                  <SkillBadge key={s.id} name={s.name} />
                ))}
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <DeveloperAvatar developers={developers} developer={assignee} />
              <AssigneeSelect
                developers={developers}
                requiredSkills={task.requiredSkills}
                value={task.assigneeId}
                onChange={(assigneeId) => onUpdate(task.id, { assigneeId })}
                className="h-9 min-w-0 flex-1"
              />
              <StatusSelect
                value={task.status}
                onChange={(status) => onUpdate(task.id, { status })}
                doneDisabled={blocked}
                className="h-8 shrink-0"
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
