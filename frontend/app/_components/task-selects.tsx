"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Developer, Skill, TaskPriority, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

import {
  PRIORITIES,
  PRIORITY_LABEL,
  PRIORITY_STYLE,
  STATUSES,
  STATUS_LABEL,
  STATUS_STYLE,
  missingSkills,
} from "./task-ui";

const UNASSIGNED = "__unassigned";

type AssigneeProps = {
  developers: Developer[];
  requiredSkills: Skill[];
  value: string | null;
  onChange: (assigneeId: string | null) => void;
  /** Developers without every required skill cannot be picked. */
  strict?: boolean;
  /** Hide ineligible developers entirely instead of listing them disabled. */
  eligibleOnly?: boolean;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
};

/**
 * Assignee picker. Options are split into an Eligible group (developers who
 * hold every required skill) and an Ineligible group, each listed with the
 * skills they are missing and disabled while `strict` is on.
 */
export function AssigneeSelect({
  developers,
  requiredSkills,
  value,
  onChange,
  strict = true,
  eligibleOnly = false,
  disabled,
  placeholder = "Unassigned",
  id,
  className,
}: AssigneeProps) {
  const eligible: Developer[] = [];
  const ineligible: { dev: Developer; missing: Skill[] }[] = [];
  for (const dev of developers) {
    const missing = missingSkills(dev, requiredSkills);
    if (missing.length === 0) eligible.push(dev);
    else ineligible.push({ dev, missing });
  }

  return (
    <Select
      value={value ?? UNASSIGNED}
      onValueChange={(v) => onChange(v === UNASSIGNED ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        aria-label="Assign developer"
        className={cn("w-full", !value && "text-muted-foreground", className)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>Eligible</SelectLabel>
          {eligible.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
          {eligible.length === 0 ? (
            <div className="px-1.5 py-1 text-xs text-red-700">
              No developer has all the required skills.
            </div>
          ) : null}
        </SelectGroup>
        {!eligibleOnly && ineligible.length > 0 ? (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Ineligible</SelectLabel>
              {ineligible.map(({ dev, missing }) => (
                <SelectItem
                  key={dev.id}
                  value={dev.id}
                  disabled={strict}
                  textValue={dev.name}
                >
                  <span className="flex flex-col">
                    <span>{dev.name}</span>
                    <span className="text-xs text-muted-foreground">
                      missing {missing.map((s) => s.name).join(", ")}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        ) : null}
      </SelectContent>
    </Select>
  );
}

const pillTrigger =
  "h-7 rounded-full border-transparent px-2.5 text-xs font-semibold shadow-none [&_svg]:text-current [&_svg]:opacity-70";

/**
 * Status picker. `doneDisabled` greys out "Done" while the task still has open
 * subtasks — the server refuses that transition with a 409, so the option is
 * withheld up front rather than offered and rolled back.
 */
export function StatusSelect({
  value,
  onChange,
  doneDisabled = false,
  className,
}: {
  value: TaskStatus;
  onChange: (status: TaskStatus) => void;
  doneDisabled?: boolean;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TaskStatus)}>
      <SelectTrigger
        aria-label="Update status"
        className={cn(pillTrigger, STATUS_STYLE[value], className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUSES.map((s) => {
          const blocked = s === "done" && doneDisabled && value !== "done";
          return (
            <SelectItem
              key={s}
              value={s}
              disabled={blocked}
              textValue={STATUS_LABEL[s]}
            >
              {blocked ? (
                <span className="flex flex-col">
                  <span>{STATUS_LABEL[s]}</span>
                  <span className="text-xs text-muted-foreground">
                    Finish all subtasks first
                  </span>
                </span>
              ) : (
                STATUS_LABEL[s]
              )}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export function PrioritySelect({
  value,
  onChange,
  pill = true,
  className,
}: {
  value: TaskPriority;
  onChange: (priority: TaskPriority) => void;
  pill?: boolean;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as TaskPriority)}>
      <SelectTrigger
        aria-label="Priority"
        className={cn(pill && [pillTrigger, PRIORITY_STYLE[value]], className)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRIORITIES.map((p) => (
          <SelectItem key={p} value={p}>
            {PRIORITY_LABEL[p]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
