import { ExternalLink as ExternalLinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A link that opens in a new tab, with a visible icon and a screen-reader
 * hint saying so. `mailto:` links open the mail app, so they get neither.
 */
export default function ExternalLink({
  href,
  className,
  showIcon = true,
  children,
}: {
  href: string;
  className?: string;
  showIcon?: boolean;
  children: React.ReactNode;
}) {
  if (href.startsWith("mailto:")) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn("inline-flex items-center gap-1", className)}>
      {children}
      {showIcon && <ExternalLinkIcon className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />}
      <span className="sr-only">(opens in new tab)</span>
    </a>
  );
}
