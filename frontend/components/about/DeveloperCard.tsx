import { Briefcase, CodeXml, Globe, Mail, type LucideIcon } from "lucide-react";
import ExternalLink from "@/components/ExternalLink";
import type { AboutContent } from "@/content/about";
import { filledLinks, isPlaceholder } from "@/lib/about";

type Developer = AboutContent["developer"];

const LINK_ICONS: Record<Developer["links"][number]["label"], LucideIcon> = {
  GitHub: CodeXml,
  LinkedIn: Briefcase,
  Website: Globe,
  Email: Mail,
};

/**
 * Shows only the details that have been filled in; the page leaves the
 * whole section out while the name is still a placeholder (see hasDeveloper).
 */
export default function DeveloperCard({ content }: { content: AboutContent }) {
  const developer = content.developer;
  const links = filledLinks(content);
  const avatar = developer.avatarUrl && !isPlaceholder(developer.avatarUrl) ? developer.avatarUrl : undefined;

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-foreground/10 sm:flex-row">
      {avatar && (
        // Any host is allowed here, so a plain <img> instead of next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatar} alt="" width={80} height={80} className="h-20 w-20 shrink-0 rounded-full object-cover" />
      )}

      <div className="min-w-0">
        <h3 className="text-lg font-semibold">{developer.name}</h3>
        {!isPlaceholder(developer.role) && <p className="text-sm font-medium text-muted-foreground">{developer.role}</p>}
        {!isPlaceholder(developer.bio) && <p className="mt-2 max-w-2xl text-sm leading-relaxed">{developer.bio}</p>}

        {developer.openToWork && (
          <p className="mt-2 inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
            Open to opportunities
          </p>
        )}

        {links.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {links.map((link) => {
              const Icon = LINK_ICONS[link.label];

              return (
                <li key={link.label}>
                  <ExternalLink
                    href={link.href}
                    showIcon={false}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium ring-1 ring-foreground/15 transition-colors hover:bg-muted"
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {link.label}
                  </ExternalLink>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
