"use client";

import {
  Controller,
  useFormContext,
  useWatch,
  type FieldErrors,
} from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Developer, Skill } from "@/types";

import { SkillPicker } from "./skill-picker";
import { AssigneeSelect } from "./task-selects";
import { eligibleDevelopers, hasAllSkills } from "./task-ui";

/**
 * One task's worth of form state. Subtasks have exactly the same fields, so
 * the type is recursive and the same component renders every level.
 */
export type TaskFormValues = {
  title: string;
  description: string;
  skills: Skill[];
  assigneeId: string | null;
  subtasks: TaskFormValues[];
};

export const emptyTask = (): TaskFormValues => ({
  title: "",
  description: "",
  skills: [],
  assigneeId: null,
  subtasks: [],
});

/**
 * Where a task sits in the form: `""` for the root, `"subtasks.0."` for its
 * first subtask, `"subtasks.0.subtasks.2."` one level down, and so on. Field
 * names are built by appending to it. The casts to root field names are how
 * dynamic paths meet react-hook-form's typed API; the runtime path is what is
 * registered.
 */
export type FormPath = "" | `${string}.`;

/** The errors object for the task at `path`, if any of its fields failed. */
export function errorsAt(
  errors: FieldErrors<TaskFormValues>,
  path: FormPath,
): FieldErrors<TaskFormValues> | undefined {
  let node: unknown = errors;
  for (const segment of path.split(".").filter(Boolean)) {
    if (node == null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[segment];
  }
  return node as FieldErrors<TaskFormValues> | undefined;
}

type Props = {
  path: FormPath;
  /** Prefix for element ids so labels stay wired at every level. */
  idPrefix: string;
  skills: Skill[];
  developers: Developer[];
  /** Fewer description rows and no autofocus, for subtasks. */
  compact?: boolean;
};

const label = "text-[13px] font-semibold";
const required = <span className="text-red-400">*</span>;
const errorText = "text-xs text-red-600";

/**
 * The fields every task has — title, description, required skills, assignee —
 * bound to the form at `path`. Rendered once for the
 * root task and once per subtask at any depth.
 */
export function TaskFormFields({
  path,
  idPrefix,
  skills,
  developers,
  compact = false,
}: Props) {
  const { register, control, getValues, setValue, formState } =
    useFormContext<TaskFormValues>();
  const { errors: allErrors, isSubmitted } = formState;
  const errors = errorsAt(allErrors, path);

  const skillsName = `${path}skills` as "skills";
  const assigneeName = `${path}assigneeId` as "assigneeId";

  const selected = useWatch({ control, name: skillsName }) ?? [];
  const matches = selected.length
    ? eligibleDevelopers(developers, selected)
    : [];

  /** Skills changed: drop an assignee who no longer holds all of them. */
  const setSkills = (next: Skill[]) => {
    setValue(skillsName, next, { shouldValidate: isSubmitted });
    const assignee = developers.find((d) => d.id === getValues(assigneeName));
    if (assignee && !hasAllSkills(assignee, next)) setValue(assigneeName, null);
  };

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-title`} className={label}>
          Task name {required}
        </Label>
        <Input
          id={`${idPrefix}-title`}
          autoFocus={!compact}
          placeholder={
            compact
              ? "e.g. Write the migration"
              : "e.g. Migrate service"
          }
          aria-invalid={errors?.title ? true : undefined}
          className="h-10 text-base md:text-[15px]"
          {...register(`${path}title` as "title", {
            validate: (v) => v.trim().length > 0 || "Give the task a name.",
          })}
        />
        {errors?.title ? (
          <span className={errorText}>{errors.title.message}</span>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-description`} className={label}>
          Description
        </Label>
        <Textarea
          id={`${idPrefix}-description`}
          rows={compact ? 3 : 6}
          placeholder="What does done look like?"
          className="field-sizing-fixed resize-y"
          {...register(`${path}description` as "description")}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>Required skills</span>
        <span className="text-xs text-muted-foreground">
          Leave empty and the required skills will be inferred from the task name.
        </span>
        <Controller
          control={control}
          name={skillsName}
          render={({ field }) => (
            <SkillPicker skills={skills} value={field.value} onChange={setSkills} />
          )}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-assignee`} className={label}>
          Assignee
        </Label>
        <span className="text-xs text-muted-foreground">
          {selected.length === 0
            ? "Only developers holding every required skill will be shown. This can be assigned later"
            : matches.length
              ? `${matches.length} eligible developer${matches.length > 1 ? "s" : ""}: ${matches.map((d) => d.name).join(", ")}`
              : "No developer currently has all of these skills. Leave unassigned for now."}
        </span>
        <Controller
          control={control}
          name={assigneeName}
          render={({ field }) => (
            <AssigneeSelect
              id={`${idPrefix}-assignee`}
              developers={developers}
              requiredSkills={selected}
              value={field.value}
              onChange={field.onChange}
              eligibleOnly
              disabled={selected.length === 0 || matches.length === 0}
              placeholder={
                selected.length === 0 ? "Pick skills to assign now" : "Unassigned"
              }
              className="h-10"
            />
          )}
        />
      </div>
    </>
  );
}
