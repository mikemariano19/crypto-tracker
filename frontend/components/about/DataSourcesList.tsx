import ExternalLink from "@/components/ExternalLink";
import type { AboutContent } from "@/content/about";

export default function DataSourcesList({
  sources,
  attribution,
  newsNote,
}: {
  sources: AboutContent["dataSources"];
  attribution: AboutContent["attribution"];
  newsNote: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        <ExternalLink href={attribution.url} className="underline underline-offset-2 hover:no-underline">
          {attribution.text}
        </ExternalLink>
      </p>

      <ul className="divide-y overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-foreground/10">
        {sources.map((source) => (
          <li key={source.name} className="flex flex-col gap-0.5 px-4 py-2.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <ExternalLink href={source.url} className="font-medium hover:underline">
              {source.name}
            </ExternalLink>
            <span className="text-muted-foreground">{source.usage}</span>
          </li>
        ))}
      </ul>

      <p className="max-w-2xl text-sm text-muted-foreground">{newsNote}</p>
    </div>
  );
}
