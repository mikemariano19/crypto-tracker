import { TriangleAlert } from "lucide-react";

/** Full-size and boxed on purpose: the spec wants this impossible to miss. */
export default function DisclaimerBox({ text }: { text: string }) {
  return (
    <div role="note" className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
      <p className="text-sm leading-relaxed sm:text-base">{text}</p>
    </div>
  );
}
