import type { Developer } from "@/lib/types";
import { cn } from "@/lib/utils";

import { avatarStyle, initials } from "./task-ui";

type Props = {
  developers: Developer[];
  developer: Developer | null | undefined;
  className?: string;
};

/** Initials bubble; dashed and empty when nobody is assigned. */
export function DeveloperAvatar({ developers, developer, className }: Props) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6.5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white",
        developer
          ? avatarStyle(developers, developer.id)
          : "border-[1.5px] border-dashed border-zinc-400",
        className,
      )}
    >
      {developer ? initials(developer.name) : ""}
    </span>
  );
}
