"use client";

import { FormProvider, useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { SidePanel } from "@/components/ui/side-panel";
import { Separator } from "@/components/ui/separator";
import type { Developer, Skill } from "@/lib/types";

import { SubtaskList } from "./subtask-fields";
import {
  TaskFormFields,
  emptyTask,
  type TaskFormValues,
} from "./task-form-fields";

/** A task to create, with its subtasks nested the same way, any depth. */
export type NewTaskInput = {
  title: string;
  description: string;
  skills: Skill[];
  assigneeId: string | null;
  subtasks: NewTaskInput[];
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

function toInput(values: TaskFormValues): NewTaskInput {
  return {
    title: values.title.trim(),
    description: values.description.trim(),
    skills: values.skills,
    assigneeId: values.assigneeId,
    subtasks: values.subtasks.map(toInput),
  };
}

function countTree(values: TaskFormValues[]): number {
  return values.reduce((n, v) => n + 1 + countTree(v.subtasks), 0);
}

/**
 * The create form. The root task's fields are `TaskFormFields` at the empty
 * path; below them `SubtaskList` renders a card per subtask, each with the
 * same fields and its own list, so nested subtasks are built in place and
 * sent as one tree.
 */
export function CreateTaskPanel({
  skills,
  developers,
  onCreate,
  pending = false,
  onClose,
}: Props) {
  const form = useForm<TaskFormValues>({ defaultValues: emptyTask() });
  const subtaskCount = countTree(
    useWatch({ control: form.control, name: "subtasks" }),
  );

  const submit = form.handleSubmit((values) => onCreate(toInput(values)));

  return (
    <SidePanel
      title="New task"
      onClose={onClose}
      header={<h2 className="text-base font-bold">New task</h2>}
    >
      <FormProvider {...form}>
        <form
          onSubmit={submit}
          noValidate
          className="flex flex-1 flex-col gap-7 px-6 pt-6 pb-8"
        >
          <TaskFormFields
            path=""
            idPrefix="new-task"
            skills={skills}
            developers={developers}
          />

          <Separator />

          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13px] font-semibold">Subtasks</span>
                <span className="text-xs text-muted-foreground">
                  Optional. Subtasks can have subtasks of their own.
                </span>
              </div>
              {subtaskCount > 0 ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {subtaskCount} in total
                </span>
              ) : null}
            </div>
            <SubtaskList path="" skills={skills} developers={developers} />
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
      </FormProvider>
    </SidePanel>
  );
}
