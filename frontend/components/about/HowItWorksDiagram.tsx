import { Fragment } from "react";
import { cn } from "@/lib/utils";
import type { AboutContent } from "@/content/about";

// Each lane is drawn as boxes joined by inline-SVG arrows rather than one
// big SVG, so the labels stay readable and wrap on a phone. Colours come
// from theme tokens (currentColor), so it follows the site theme.
// The numbered steps beside it are the text alternative; the drawing itself
// is hidden from screen readers.

function Arrow() {
  return (
    <svg viewBox="0 0 24 12" className="h-3 w-6 shrink-0 text-muted-foreground/70" aria-hidden="true">
      <path d="M0 6h20M16 1.5 21.5 6 16 10.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function HowItWorksDiagram({ steps, lanes }: { steps: string[]; lanes: AboutContent["diagram"] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-foreground/10" aria-hidden="true">
        <ul className="space-y-3">
          {lanes.map((lane) => (
            <li key={lane.output} className="flex flex-wrap items-center gap-x-1.5 gap-y-2 text-xs font-medium">
              {lane.steps.map((step) => (
                <Fragment key={step.label}>
                  <span
                    className={cn(
                      "rounded-md px-2 py-1",
                      step.pending
                        ? "border border-dashed border-amber-500 text-amber-800"
                        : "bg-muted text-foreground"
                    )}
                  >
                    {step.label}
                    {step.pending && <span className="ml-1 font-normal">· coming soon</span>}
                  </span>
                  <Arrow />
                </Fragment>
              ))}
              <span className="rounded-md bg-foreground px-2 py-1 text-background">{lane.output}</span>
            </li>
          ))}
        </ul>
      </div>

      <ol className="grid gap-x-6 gap-y-2 text-sm text-muted-foreground md:grid-cols-2">
        {steps.map((step, i) => (
          <li key={step} className="flex gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-foreground">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
