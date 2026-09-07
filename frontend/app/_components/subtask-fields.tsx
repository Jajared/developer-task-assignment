"use client";

import { useState } from "react";
import { ChevronDownIcon, PlusIcon, XIcon } from "lucide-react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { MAX_SUBTASK_DEPTH } from "@/lib/constants";
import type { Developer, Skill } from "@/lib/types";
import { cn } from "@/lib/utils";

import {
  TaskFormFields,
  emptyTask,
  errorsAt,
  type FormPath,
  type TaskFormValues,
} from "./task-form-fields";

type ListProps = {
  /** Path of the task whose subtasks this list edits (`""` for the root). */
  path: FormPath;
  /** Numbering prefix for the cards, e.g. `"2."` under the second subtask. */
  numbering?: string;
  /** Depth of the task that owns this list; its subtasks sit at `depth + 1`. */
  depth?: number;
  /** Deepest level a subtask may sit at. Defaults to the configured limit. */
  maxDepth?: number;
  skills: Skill[];
  developers: Developer[];
};

/**
 * The dynamic part of the create form. One field array per task, rendered as
 * a card per subtask; each card renders `TaskFormFields` for its own path and
 * then this list again for its own subtasks, so the tree can go as deep as
 * `maxDepth` allows — the recursion itself has no limit. Cards are keyed by the field array's stable id, never the
 * index, so removing one in the middle keeps the others' state.
 */
export function SubtaskList({
  path,
  numbering = "",
  depth = 0,
  maxDepth = MAX_SUBTASK_DEPTH,
  skills,
  developers,
}: ListProps) {
  const { control } = useFormContext<TaskFormValues>();
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${path}subtasks` as "subtasks",
  });
  // A subtask added here would sit one level below this list's owner.
  const canAdd = depth + 1 <= maxDepth;

  return (
    <div className={cn("flex flex-col gap-3", depth > 0 && "pt-1")}>
      {fields.map((field, index) => (
        <SubtaskCard
          key={field.id}
          path={`${path}subtasks.${index}.`}
          label={`${numbering}${index + 1}`}
          depth={depth}
          maxDepth={maxDepth}
          skills={skills}
          developers={developers}
          onRemove={() => remove(index)}
        />
      ))}
      {canAdd ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => append(emptyTask())}
          className="self-start"
        >
          <PlusIcon />
          {depth === 0 ? "Add subtask" : "Add nested subtask"}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">
          Subtasks can be nested up to {maxDepth} levels deep.
        </p>
      )}
    </div>
  );
}

type CardProps = {
  path: FormPath;
  /** Dotted position in the tree: "1", "1.2", "1.2.1"… */
  label: string;
  depth: number;
  maxDepth: number;
  skills: Skill[];
  developers: Developer[];
  onRemove: () => void;
};

function SubtaskCard({
  path,
  label,
  depth,
  maxDepth,
  skills,
  developers,
  onRemove,
}: CardProps) {
  const { control, formState } = useFormContext<TaskFormValues>();
  const [open, setOpen] = useState(true);
  const title = useWatch({ control, name: `${path}title` as "title" });
  const invalid = !!errorsAt(formState.errors, path);
  // A collapsed card must not hide a validation error.
  const expanded = open || invalid;
  const idPrefix = `subtask-${path.replace(/\W+/g, "-").replace(/-$/, "")}`;

  return (
    <div
      className={cn(
        "rounded-lg border border-l-4 bg-background",
        invalid ? "border-l-red-400" : "border-l-primary/40",
      )}
    >
      <div className="flex items-center gap-1 py-1 pr-1 pl-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={expanded}
          aria-controls={`${idPrefix}-body`}
          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
        >
          <ChevronDownIcon
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              !expanded && "-rotate-90",
            )}
          />
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">
            Subtask {label}
          </span>
          {!expanded ? (
            <span className="truncate text-[13px]">
              {title?.trim() || (
                <span className="text-muted-foreground italic">Untitled</span>
              )}
            </span>
          ) : null}
        </button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove subtask ${label}`}
          onClick={onRemove}
        >
          <XIcon />
        </Button>
      </div>

      <div
        id={`${idPrefix}-body`}
        hidden={!expanded}
        className="flex flex-col gap-5 border-t px-3 pt-4 pb-3"
      >
        <TaskFormFields
          path={path}
          idPrefix={idPrefix}
          skills={skills}
          developers={developers}
          compact
        />
        <div className="ml-0.5 border-l-2 border-dashed pl-2 sm:ml-1 sm:pl-3">
          <SubtaskList
            path={path}
            numbering={`${label}.`}
            depth={depth + 1}
            maxDepth={maxDepth}
            skills={skills}
            developers={developers}
          />
        </div>
      </div>
    </div>
  );
}
