import type { AboutContent } from "@/content/about";
import { formatAboutDate } from "@/lib/about";

export default function Changelog({
  app,
  changelog,
  roadmap,
}: {
  app: AboutContent["app"];
  changelog: NonNullable<AboutContent["changelog"]>;
  roadmap: NonNullable<AboutContent["roadmap"]>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-foreground/10">
        <h3 className="text-sm font-semibold">Latest changes</h3>
        <p className="text-xs text-muted-foreground">
          Version {app.version} · updated <time dateTime={app.lastUpdated}>{formatAboutDate(app.lastUpdated)}</time>
        </p>

        {changelog.slice(0, 5).map((entry) => (
          <div key={entry.version} className="mt-3">
            <p className="text-xs font-medium">
              v{entry.version} · <time dateTime={entry.date}>{formatAboutDate(entry.date)}</time>
            </p>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {entry.changes.map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {roadmap.length > 0 && (
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-foreground/10">
          <h3 className="text-sm font-semibold">Roadmap</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {roadmap.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Planned</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
