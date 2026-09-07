"use client";

import { ChevronRightIcon, CornerDownRightIcon } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TaskStatus,
  type Developer,
  type Task,
  type TaskPatch,
} from "@/lib/types";
import { cn } from "@/lib/utils";

import { DeveloperAvatar } from "./developer-avatar";
import { SkillBadge } from "./skill-badge";
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

const headCell =
  "sticky top-0 h-auto bg-background px-3 pt-3 pb-2 text-xs font-medium text-muted-foreground border-l first:border-l-0 first:pl-0";
const bodyCell =
  "px-3 py-2.5 align-middle border-l first:border-l-0 first:pl-0";

export function TaskTable({
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
  return (
    <Table className="min-w-205 border-separate border-spacing-0">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className={cn(headCell, "min-w-65 border-b")}>
            Task name
          </TableHead>
          <TableHead className={cn(headCell, "border-b")}>
            Required skills
          </TableHead>
          <TableHead className={cn(headCell, "w-55 border-b")}>
            Assignee
          </TableHead>
          <TableHead className={cn(headCell, "w-37.5 border-b")}>
            Status
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {flattenTree(tasks, expanded).map(({ task, depth, childCount }) => {
          const done = task.status === TaskStatus.Done;
          const blocked = hasUnfinishedSubtasks(task, allTasks);
          const isExpanded = expanded.has(task.id);
          const assignee =
            developers.find((d) => d.id === task.assigneeId) ?? null;
          const selected = task.id === selectedId;
          return (
            <TableRow
              key={task.id}
              data-state={selected ? "selected" : undefined}
              className="data-[state=selected]:bg-violet-50"
            >
              <TableCell className={cn(bodyCell, "border-b")}>
                <div
                  className="flex items-start gap-1"
                  style={depth ? { paddingLeft: depth * 20 } : undefined}
                >
                  {childCount > 0 ? (
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-label={`${isExpanded ? "Hide" : "Show"} ${childCount} subtask${childCount > 1 ? "s" : ""}`}
                      onClick={() => onToggleExpanded(task.id)}
                      className="-ml-1 flex h-5 shrink-0 items-center gap-0.5 rounded px-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
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
                      done
                        ? "text-muted-foreground line-through"
                        : "text-foreground",
                    )}
                  >
                    {task.title}
                  </div>
                  {showDescriptions && task.description ? (
                    <div className="mt-px max-w-[44ch] truncate text-xs text-muted-foreground">
                      {task.description}
                    </div>
                  ) : null}
                  </span>
                </button>
                </div>
              </TableCell>
              <TableCell className={cn(bodyCell, "border-b")}>
                <div className="flex flex-wrap gap-1.5">
                  {task.requiredSkills.map((s) => (
                    <SkillBadge key={s.id} name={s.name} />
                  ))}
                </div>
              </TableCell>
              <TableCell className={cn(bodyCell, "border-b")}>
                <div className="flex items-center gap-2">
                  <DeveloperAvatar
                    developers={developers}
                    developer={assignee}
                  />
                  <AssigneeSelect
                    developers={developers}
                    requiredSkills={task.requiredSkills}
                    value={task.assigneeId}
                    onChange={(assigneeId) => onUpdate(task.id, { assigneeId })}
                    className="h-8 min-w-0 flex-1 border-transparent bg-transparent shadow-none hover:border-border"
                  />
                </div>
              </TableCell>
              <TableCell className={cn(bodyCell, "border-b")}>
                <StatusSelect
                  value={task.status}
                  onChange={(status) => onUpdate(task.id, { status })}
                  doneDisabled={blocked}
                  className="w-full"
                />
              </TableCell>
            </TableRow>
          );
        })}
        {tasks.length === 0 ? (
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={5}
              className="py-10 text-center text-sm text-muted-foreground"
            >
              No tasks match this filter.
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  );
}
