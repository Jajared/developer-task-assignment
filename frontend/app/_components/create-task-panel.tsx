"use client";

import { Controller, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TaskPriority, type Developer, type Skill } from "@/lib/types";
import { cn } from "@/lib/utils";

import { SidePanel } from "./side-panel";
import { AssigneeSelect, PrioritySelect } from "./task-selects";
import { eligibleDevelopers, hasAllSkills, skillStyle } from "./task-ui";

export type NewTaskInput = {
  title: string;
  description: string;
  skills: Skill[];
  priority: TaskPriority;
  dueDate: string | null;
  assigneeId: string | null;
};

type FormValues = {
  title: string;
  description: string;
  skills: Skill[];
  priority: TaskPriority;
  dueDate: string;
  assigneeId: string | null;
};

type Props = {
  /** The seeded skill pool from the API; there is no route to add to it. */
  skills: Skill[];
  developers: Developer[];
  onCreate: (input: NewTaskInput) => void;
  /** True while the create request is in flight. */
  pending?: boolean;
  onClose: () => void;
};

const label = "text-[13px] font-semibold";
const required = <span className="text-red-400">*</span>;
const errorText = "text-xs text-red-600";

export function CreateTaskPanel({
  skills,
  developers,
  onCreate,
  pending = false,
  onClose,
}: Props) {
  const { register, control, handleSubmit, getValues, setValue, formState } =
    useForm<FormValues>({
      defaultValues: {
        title: "",
        description: "",
        skills: [],
        priority: TaskPriority.Medium,
        dueDate: "",
        assigneeId: null,
      },
    });
  const { errors, isSubmitted } = formState;

  const selected = useWatch({ control, name: "skills" });
  const matches = selected.length
    ? eligibleDevelopers(developers, selected)
    : [];

  /** Skills changed: drop an assignee who no longer holds all of them. */
  const setSkills = (next: Skill[]) => {
    setValue("skills", next, { shouldValidate: isSubmitted });
    const assignee = developers.find((d) => d.id === getValues("assigneeId"));
    if (assignee && !hasAllSkills(assignee, next)) setValue("assigneeId", null);
  };

  const submit = handleSubmit((values) => {
    onCreate({
      title: values.title.trim(),
      description: values.description.trim(),
      skills: values.skills,
      priority: values.priority,
      dueDate: values.dueDate || null,
      assigneeId: values.assigneeId,
    });
  });

  return (
    <SidePanel
      title="New task"
      onClose={onClose}
      header={<h2 className="text-base font-bold">New task</h2>}
    >
      <form
        onSubmit={submit}
        noValidate
        className="flex flex-1 flex-col gap-7 px-6 pt-6 pb-8"
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-task-title" className={label}>
            Task name {required}
          </Label>
          <Input
            id="new-task-title"
            autoFocus
            placeholder="e.g. Migrate auth service to OAuth 2.1"
            aria-invalid={errors.title ? true : undefined}
            className="h-10 text-[15px] md:text-[15px]"
            {...register("title", {
              validate: (v) => v.trim().length > 0 || "Give the task a name.",
            })}
          />
          {errors.title ? (
            <span className={errorText}>{errors.title.message}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-task-description" className={label}>
            Description
          </Label>
          <Textarea
            id="new-task-description"
            rows={6}
            placeholder="What does done look like?"
            className="field-sizing-fixed resize-y"
            {...register("description")}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className={label}>Required skills {required}</span>
          <Controller
            control={control}
            name="skills"
            rules={{
              validate: (v) => v.length > 0 || "Pick at least one skill.",
            }}
            render={({ field }) => (
              <div className="flex flex-wrap gap-2">
                {skills.map((s) => {
                  const on = field.value.some((x) => x.id === s.id);
                  return (
                    <button
                      key={s.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        setSkills(
                          on
                            ? field.value.filter((x) => x.id !== s.id)
                            : [...field.value, s],
                        )
                      }
                      className={cn(
                        "h-8 rounded-full border-[1.5px] px-3.5 text-[13px] font-medium transition-colors",
                        on
                          ? cn("border-transparent", skillStyle(s.name))
                          : "border-border bg-background text-foreground hover:bg-muted",
                      )}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            )}
          />
          {errors.skills ? (
            <span className={errorText}>{errors.skills.message}</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-task-assignee" className={label}>
            Assignee
          </Label>
          <span className="text-xs text-muted-foreground">
            {selected.length === 0
              ? "Only developers holding every required skill will be offered."
              : matches.length
                ? `${matches.length} eligible developer${matches.length > 1 ? "s" : ""}: ${matches.map((d) => d.name).join(", ")}`
                : "No developer currently has all of these skills. Leave unassigned for now."}
          </span>
          <Controller
            control={control}
            name="assigneeId"
            render={({ field }) => (
              <AssigneeSelect
                id="new-task-assignee"
                developers={developers}
                requiredSkills={selected}
                value={field.value}
                onChange={field.onChange}
                eligibleOnly
                disabled={selected.length === 0 || matches.length === 0}
                placeholder={
                  selected.length === 0
                    ? "Pick required skills first"
                    : "Unassigned"
                }
                className="h-10"
              />
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <span className={label}>Priority</span>
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <PrioritySelect
                  value={field.value}
                  onChange={field.onChange}
                  pill={false}
                  className="h-10 w-full"
                />
              )}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-task-due" className={label}>
              Due date
            </Label>
            <Input
              id="new-task-due"
              type="date"
              className="h-10 min-w-0"
              {...register("dueDate")}
            />
          </div>
        </div>

        <div className="mt-auto flex justify-end gap-2.5 border-t pt-4">
          <Button type="button" variant="outline" size="lg" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={pending}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {pending ? "Creating…" : "Create task"}
          </Button>
        </div>
      </form>
    </SidePanel>
  );
}
