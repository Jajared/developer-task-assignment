"use client";

import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Props = {
  /** Accessible name for the dialog; rendered visually only if `header` omits it. */
  title: string;
  /** Left-hand content of the header row: the visible title or an action. */
  header: React.ReactNode;
  onClose: () => void;
  /** Extra classes on the sheet, e.g. a wider panel for a long form. */
  className?: string;
  children: React.ReactNode;
};

/**
 * Right-hand overlay panel. Floats above the task list with a backdrop rather
 * than pushing the layout; closes on Escape, backdrop click or the X.
 */
export function SidePanel({
  title,
  header,
  onClose,
  className,
  children,
}: Props) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className={cn(
          // The Sheet base sets `data-[side=right]:sm:max-w-sm`; the override must
          // carry the same variant or the base wins on specificity.
          "w-full gap-0 overflow-y-auto p-0 pb-[env(safe-area-inset-bottom)] data-[side=right]:w-full sm:w-[34rem] data-[side=right]:sm:max-w-[34rem]",
          className,
        )}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5 sm:py-3.5">
          {header}
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close panel"
            onClick={onClose}
          >
            <XIcon />
          </Button>
        </div>
        {children}
      </SheetContent>
    </Sheet>
  );
}
