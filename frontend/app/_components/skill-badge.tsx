import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { skillStyle } from "./task-ui";

export function SkillBadge({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("border-transparent", skillStyle(name), className)}
    >
      {name}
    </Badge>
  );
}
