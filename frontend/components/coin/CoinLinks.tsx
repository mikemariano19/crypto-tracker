"use client";

import { useState } from "react";
import { Check, Code, Copy, FileText, Globe, Link2, MessageCircle, Search } from "lucide-react";
import ExternalLink from "@/components/ExternalLink";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { CoinContract, CoinLinks as Links } from "@/types/crypto";

// Contracts shown before "Show all"; tokens can be on dozens of chains.
const FIRST_CONTRACTS = 3;

// CoinGecko platform ids that don't title-case well.
const PLATFORM_NAMES: Record<string, string> = {
  "binance-smart-chain": "BNB Smart Chain",
  "polygon-pos": "Polygon",
  "arbitrum-one": "Arbitrum",
  "optimistic-ethereum": "Optimism",
  "avalanche": "Avalanche C-Chain",
  "the-open-network": "TON",
  "tron": "TRON",
  "zksync": "zkSync",
};

export function platformName(id: string): string {
  return PLATFORM_NAMES[id] ?? id.split("-").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

/** "etherscan.io" from an explorer URL, for its label. */
function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function shortAddress(address: string): string {
  return address.length > 16 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address;
}

function LinkChip({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <ExternalLink
      href={href}
      className="rounded-full border bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900"
    >
      {icon}
      {children}
    </ExternalLink>
  );
}

function ContractRow({ contract }: { contract: CoinContract }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(contract.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (http on a LAN IP, or denied): the address is still selectable.
    }
  };

  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{platformName(contract.platform)}</p>
        <p className="truncate font-mono text-sm text-gray-900" title={contract.address}>
          <span className="sm:hidden">{shortAddress(contract.address)}</span>
          <span className="hidden sm:inline">{contract.address}</span>
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : `Copy ${platformName(contract.platform)} contract address`}
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
          copied ? "border-green-200 bg-green-50 text-green-700" : "bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900"
        )}
      >
        {copied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
        {copied ? "Copied" : "Copy"}
      </button>
    </li>
  );
}

/**
 * Official website, docs, explorers and socials, plus contract addresses
 * so people can check they have the real token and not a copycat.
 */
export default function CoinLinks({ name, links, contracts = [] }: { name: string; links?: Links; contracts?: CoinContract[] }) {
  const [showAll, setShowAll] = useState(false);

  const chips = links
    ? [
        links.homepage && { href: links.homepage, icon: <Globe className="h-3.5 w-3.5" aria-hidden="true" />, label: "Website" },
        links.whitepaper && { href: links.whitepaper, icon: <FileText className="h-3.5 w-3.5" aria-hidden="true" />, label: "Whitepaper" },
        ...links.explorers.map((href) => ({ href, icon: <Search className="h-3.5 w-3.5" aria-hidden="true" />, label: hostOf(href) })),
        links.github && { href: links.github, icon: <Code className="h-3.5 w-3.5" aria-hidden="true" />, label: "GitHub" },
        links.twitter && { href: links.twitter, icon: <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />, label: "X (Twitter)" },
        links.reddit && { href: links.reddit, icon: <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />, label: "Reddit" },
        links.telegram && { href: links.telegram, icon: <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />, label: "Telegram" },
      ].filter((chip): chip is { href: string; icon: React.ReactElement; label: string } => Boolean(chip))
    : [];

  if (chips.length === 0 && contracts.length === 0) return null;

  const shown = showAll ? contracts : contracts.slice(0, FIRST_CONTRACTS);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Links
        </CardTitle>
        <CardDescription>Official {name} sites, explorers and communities</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {chips.map((chip) => (
              <LinkChip key={chip.href} href={chip.href} icon={chip.icon}>
                {chip.label}
              </LinkChip>
            ))}
          </div>
        )}

        {contracts.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Contract addresses</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Copycat tokens often reuse a real token’s name. Check the address before you buy or send.
            </p>
            <ul className="mt-1 divide-y">
              {shown.map((contract) => (
                <ContractRow key={contract.platform} contract={contract} />
              ))}
            </ul>
            {contracts.length > FIRST_CONTRACTS && (
              <button
                type="button"
                onClick={() => setShowAll((all) => !all)}
                aria-expanded={showAll}
                className="mt-1 text-sm font-medium text-gray-700 hover:text-gray-900 hover:underline"
              >
                {showAll ? "Show fewer" : `Show all ${contracts.length} chains`}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
