import type { AboutContent } from "@/content/about";

export default function TechStack({ stack }: { stack: AboutContent["stack"] }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {stack.map((group) => (
        <div key={group.group} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-foreground/10">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.group}</dt>
          <dd className="mt-2">
            <ul className="flex flex-wrap gap-1.5">
              {group.items.map((item) => (
                <li key={item} className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
                  {item}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      ))}
    </dl>
  );
}
