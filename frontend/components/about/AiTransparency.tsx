import { Ban, Check, CircleAlert, Clock, type LucideIcon } from "lucide-react";
import type { AboutContent } from "@/content/about";

function ListCard({ title, items, icon: Icon, iconClassName }: { title: string; items: string[]; icon: LucideIcon; iconClassName: string }) {
  return (
    <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-foreground/10">
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconClassName}`} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AiTransparency({ ai }: { ai: AboutContent["ai"] }) {
  const live = ai.status === "live";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>
          Model: <strong className="font-semibold">{ai.model}</strong>
        </span>
        <span
          className={
            live
              ? "rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800"
              : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
          }
        >
          {live ? "Live" : "Coming soon"}
        </span>
      </div>

      {!live && <p className="max-w-2xl text-sm text-muted-foreground">{ai.statusNote}</p>}

      <div className="grid gap-3 md:grid-cols-3">
        <ListCard title={live ? "What it does" : "What it will do"} items={ai.uses} icon={Check} iconClassName="text-green-700" />
        <ListCard title="What it doesn’t do" items={ai.doesNot} icon={Ban} iconClassName="text-red-700" />
        <ListCard title="Limitations" items={ai.limitations} icon={CircleAlert} iconClassName="text-amber-700" />
      </div>

      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
        News refreshes about every {ai.updateIntervalHours} hours.
      </p>
    </div>
  );
}
