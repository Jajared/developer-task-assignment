"use client";

import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

type Props = {
  /** Accessible name for the dialog; rendered visually only if `header` omits it. */
  title: string;
  /** Left-hand content of the header row: the visible title or an action. */
  header: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
};

/**
 * Right-hand overlay panel. Floats above the task list with a backdrop rather
 * than pushing the layout; closes on Escape, backdrop click or the X.
 */
export function SidePanel({ title, header, onClose, children }: Props) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-105 gap-0 overflow-y-auto p-0 sm:max-w-105"
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <div className="flex items-center justify-between gap-3 border-b px-5 py-3.5">
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
