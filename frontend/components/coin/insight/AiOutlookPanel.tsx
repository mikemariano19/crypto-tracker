import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import SentimentBadge from "@/components/news/SentimentBadge";
import SentimentSplitBar from "@/components/news/SentimentSplitBar";
import { LEVEL_TEXT, formatSignedPct } from "@/lib/formatNews";
import type { PriceInsight } from "@/types/insight";

const TREND_TEXT: Record<PriceInsight["trend"], string> = {
  up: "Up",
  down: "Down",
  sideways: "Sideways",
};

const RSI_STATE_TEXT: Record<NonNullable<PriceInsight["rsiState"]>, string> = {
  overbought: "overbought",
  oversold: "oversold",
  neutral: "neutral",
};

const NO_OUTLOOK_TEXT: Record<Exclude<PriceInsight["aiStatus"], "ok">, string> = {
  unavailable: "AI outlook unavailable right now.",
  budget_paused: "AI outlook paused for today (daily limit reached).",
};

function Reading({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="truncate text-xs font-semibold text-gray-900">{value}</dd>
    </div>
  );
}

export default function AiOutlookPanel({ insight }: { insight: PriceInsight }) {
  const { ai, volume } = insight;

  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-2">
        <Reading label="Trend" value={TREND_TEXT[insight.trend]} />
        <Reading
          label="RSI"
          value={insight.rsiLatest === null || !insight.rsiState ? "—" : `${Math.round(insight.rsiLatest)} ${RSI_STATE_TEXT[insight.rsiState]}`}
        />
        <Reading label="24h vol" value={volume ? formatSignedPct(volume.vsAvgPct, 0) : "—"} />
      </dl>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-500">
            AI outlook ({insight.timeframe.toUpperCase()})
          </h3>

          {ai && <SentimentBadge label={ai.label} percent={ai.outlook[ai.label]} />}
        </div>

        {ai ? (
          <div className="flex flex-col gap-2">
            <SentimentSplitBar split={ai.outlook} size="md" />

            <p className="text-xs leading-relaxed text-gray-700">{ai.summary}</p>

            {ai.reasons.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4 text-xs text-gray-600">
                {ai.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}

            <p className="text-xs text-gray-700">
              <span className="font-semibold">Watch: </span>
              {ai.watch}
            </p>

            <p className="text-xs text-gray-500">
              Confidence: <span className="font-semibold text-gray-700">{LEVEL_TEXT[ai.confidence]}</span>
            </p>

            {insight.accuracy && (
              <p className="text-[11px] text-muted-foreground">
                {insight.timeframe.toUpperCase()} outlooks matched direction {insight.accuracy.matchedPct}% of the time
                {" "}(last {insight.accuracy.days} days, {insight.accuracy.sample} outlooks across top coins).
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            {NO_OUTLOOK_TEXT[insight.aiStatus as keyof typeof NO_OUTLOOK_TEXT] ?? NO_OUTLOOK_TEXT.unavailable}
          </p>
        )}
      </div>

      <p className="flex items-start gap-1 text-[11px] leading-snug text-muted-foreground">
        <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
        <span>
          AI-generated analysis based on chart data and news.{" "}
          <Link href="/about#disclaimer" className="underline hover:text-foreground">
            Not financial advice.
          </Link>
        </span>
      </p>
    </div>
  );
}
