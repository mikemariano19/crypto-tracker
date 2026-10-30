import type { AboutContent } from "@/content/about";

export default function HighlightCards({ highlights }: { highlights: AboutContent["highlights"] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {highlights.map((highlight) => (
        <li key={highlight.title} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-foreground/10">
          <h3 className="font-semibold">{highlight.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{highlight.body}</p>
        </li>
      ))}
    </ul>
  );
}
