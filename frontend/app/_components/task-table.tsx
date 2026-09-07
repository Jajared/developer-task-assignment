"use client";

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
import { dateOnly, formatDate } from "./task-ui";

type Props = {
  tasks: Task[];
  developers: Developer[];
  selectedId: string | null;
  today: string;
  showDescriptions?: boolean;
  onOpen: (id: string) => void;
  onUpdate: (id: string, patch: TaskPatch) => void;
};

const headCell =
  "sticky top-0 h-auto bg-background px-3 pt-3 pb-2 text-xs font-medium text-muted-foreground border-l first:border-l-0 first:pl-0";
const bodyCell =
  "px-3 py-2.5 align-middle border-l first:border-l-0 first:pl-0";

export function TaskTable({
  tasks,
  developers,
  selectedId,
  today,
  showDescriptions = true,
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
          <TableHead className={cn(headCell, "w-25 border-b")}>Due</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tasks.map((task) => {
          const done = task.status === TaskStatus.Done;
          const assignee =
            developers.find((d) => d.id === task.assigneeId) ?? null;
          const due = dateOnly(task.dueDate);
          const overdue = !done && !!due && due < today;
          const selected = task.id === selectedId;
          return (
            <TableRow
              key={task.id}
              data-state={selected ? "selected" : undefined}
              className="data-[state=selected]:bg-violet-50"
            >
              <TableCell className={cn(bodyCell, "border-b")}>
                <button
                  type="button"
                  onClick={() => onOpen(task.id)}
                  className="min-w-0 flex-1 text-left outline-none focus-visible:underline"
                >
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
                </button>
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
                  className="w-full"
                />
              </TableCell>
              <TableCell
                className={cn(
                  bodyCell,
                  "border-b text-[13px]",
                  overdue ? "text-red-600" : "text-muted-foreground",
                )}
              >
                {formatDate(task.dueDate)}
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
