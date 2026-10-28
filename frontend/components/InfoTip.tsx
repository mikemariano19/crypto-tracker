"use client";

import { useState } from "react";
import { Popover } from "radix-ui";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

type InfoTipProps = {
  title: string;
  description: string;
  // Optional exact figure, e.g. the full dollar amount behind "$2.85T".
  exactValue?: string;
  // The visible trigger, e.g. a stat's icon and label.
  children: React.ReactNode;
  className?: string;
};

/**
 * Explains a metric. Opens on hover (desktop), tap (mobile) and keyboard
 * focus + Enter. Rendered in a portal so cards with overflow-hidden can't
 * clip it, and it flips/shifts to stay on screen.
 */
export default function InfoTip({
  title,
  description,
  exactValue,
  children,
  className,
}: InfoTipProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`What is ${title}?`}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className={cn(
            "group/info inline-flex cursor-help items-center gap-1.5 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            className
          )}
        >
          {children}
          <Info className="h-3 w-3 shrink-0 opacity-50 transition-opacity group-hover/info:opacity-100" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          // This is a hint, not a dialog: never move focus in or out.
          // Returning focus to the trigger on close made the browser draw a
          // keyboard focus ring around it after a plain mouse hover.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          className="z-50 max-w-72 rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg animate-in fade-in zoom-in-95 duration-100"
        >
          <p className="mb-1 text-xs font-semibold text-gray-900">{title}</p>
          <p className="text-xs leading-relaxed text-gray-600">{description}</p>
          {exactValue && (
            <p className="mt-2 flex items-baseline justify-between gap-3 border-t pt-2 text-xs">
              <span className="text-gray-500">Exact</span>
              <span className="font-semibold tabular-nums text-gray-900">{exactValue}</span>
            </p>
          )}
          <Popover.Arrow className="fill-white" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
