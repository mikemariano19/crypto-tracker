import Link from "next/link";
import { ArrowRight, Bell, ChartLine, Newspaper, Sparkles, Wallet, type LucideIcon } from "lucide-react";
import type { AboutContent } from "@/content/about";

type Feature = AboutContent["features"][number];

const ICONS: Record<Feature["icon"], LucideIcon> = {
  chart: ChartLine,
  newspaper: Newspaper,
  wallet: Wallet,
  bell: Bell,
  sparkles: Sparkles,
};

function FeatureTile({ feature }: { feature: Feature }) {
  const Icon = ICONS[feature.icon];

  return (
    <li>
      <Link
        href={feature.href}
        className="group flex h-full flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-foreground/10 transition-shadow hover:shadow-md"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h3 className="mt-3 font-semibold">{feature.title}</h3>
        <p className="mt-1 flex-1 text-sm text-muted-foreground">{feature.description}</p>
        <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium">
          Open
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

/** Only enabled features are listed, so there's never a link to a page that isn't built. */
export default function FeatureGrid({ features }: { features: Feature[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {features
        .filter((feature) => feature.enabled)
        .map((feature) => (
          <FeatureTile key={feature.id} feature={feature} />
        ))}
    </ul>
  );
}
