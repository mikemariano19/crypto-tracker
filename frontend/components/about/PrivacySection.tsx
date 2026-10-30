import { ShieldCheck } from "lucide-react";

export default function PrivacySection({ points }: { points: string[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {points.map((point) => (
        <li key={point} className="flex gap-3 rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-foreground/10">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-700" aria-hidden="true" />
          <span>{point}</span>
        </li>
      ))}
    </ul>
  );
}
