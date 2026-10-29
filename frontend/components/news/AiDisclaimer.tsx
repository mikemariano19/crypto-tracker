import { ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AiDisclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-1 text-[11px] text-muted-foreground", className)}>
      <ShieldAlert className="h-3 w-3 shrink-0" aria-hidden="true" />
      AI-generated analysis. Not financial advice.
    </p>
  );
}
