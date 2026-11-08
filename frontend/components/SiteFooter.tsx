import Link from "next/link";
import ExternalLink from "@/components/ExternalLink";
import { SITE } from "@/content/site";

// On every page: CoinGecko's attribution guide asks for visible, linked
// credit wherever its data is shown, and the market pages all show it. The
// bottom padding keeps that credit clear of BottomNav, which shows at page end.
export default function SiteFooter() {
  const year = SITE.lastUpdated.slice(0, 4);

  return (
    <footer className="mt-auto border-t bg-white pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-3 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-4">
        <ExternalLink href={SITE.attribution.url} className="font-medium text-foreground hover:underline">
          {SITE.attribution.text}
        </ExternalLink>

        <nav aria-label="Footer" className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link href="/about" className="hover:text-foreground hover:underline">
            About
          </Link>
          <Link href="/about#disclaimer" className="hover:text-foreground hover:underline">
            Not financial advice
          </Link>
          <span>
            © {year} {SITE.name}
          </span>
        </nav>
      </div>
    </footer>
  );
}
