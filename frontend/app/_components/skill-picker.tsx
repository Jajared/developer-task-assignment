"use client";

import type { Skill } from "@/lib/types";
import { cn } from "@/lib/utils";

import { skillStyle } from "./task-ui";

type Props = {
  /** The seeded skill pool from the API; there is no route to add to it. */
  skills: Skill[];
  value: Skill[];
  onChange: (next: Skill[]) => void;
};

/** Toggle chips for a task's required skills. Used at every level of the form. */
export function SkillPicker({ skills, value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((s) => {
        const on = value.some((x) => x.id === s.id);
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={on}
            onClick={() =>
              onChange(on ? value.filter((x) => x.id !== s.id) : [...value, s])
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
  );
}
