import Link from "next/link";
import { ArrowRight, CodeXml } from "lucide-react";
import ExternalLink from "@/components/ExternalLink";
import type { AboutContent } from "@/content/about";

export default function AboutHero({ app }: { app: AboutContent["app"] }) {
  return (
    <div className="pt-2">
      <span className="inline-flex rounded-full bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-foreground/10">
        {app.badge}
      </span>

      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{app.name}</h1>
      <p className="mt-2 max-w-2xl text-lg font-medium text-foreground/80">{app.tagline}</p>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{app.description}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90"
        >
          Explore the app
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>

        {app.repoUrl && (
          <ExternalLink
            href={app.repoUrl}
            className="h-10 gap-2 rounded-lg bg-white px-4 text-sm font-medium ring-1 ring-foreground/15 transition-colors hover:bg-muted"
          >
            <CodeXml className="h-4 w-4" aria-hidden="true" />
            View source on GitHub
          </ExternalLink>
        )}
      </div>
    </div>
  );
}
