"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type CSSProperties } from "react";
import { ArrowDown, ArrowUp, RefreshCw } from "lucide-react";

import AiOutlookPanel from "@/components/coin/insight/AiOutlookPanel";
import AnalyzeButton from "@/components/coin/insight/AnalyzeButton";
import IndicatorToggles from "@/components/coin/insight/IndicatorToggles";
import KeyLevelsTable from "@/components/coin/insight/KeyLevelsTable";
import NewsPinList from "@/components/coin/insight/NewsPinList";
import TimeframeToggle, { CHART_RANGES } from "@/components/coin/TimeframeToggle";
import { useCoinChart } from "@/hooks/useCoinChart";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useCachedInsight, useRunInsight } from "@/hooks/useInsight";
import { useInsightToggles } from "@/hooks/useInsightToggles";
import { useNow } from "@/hooks/useNow";
import { summarizeSeries, withLivePrice } from "@/lib/chartSeries";
import { formatRelativeTime } from "@/lib/formatNews";
import { insightTimeframe, isInsightFresh, nearestLevelsText } from "@/lib/insight";
import { formatFiatCompact, formatFiatPrice } from "@/lib/money";
import type { ChartRange } from "@/types/chart";

const CHART_HEIGHT = "h-[300px] sm:h-[380px]";

// Each indicator pane adds this much height, so the price pane keeps its size.
const PANE_HEIGHT_PX = 96;

const ChartSkeleton = () => <div className={`${CHART_HEIGHT} w-full animate-pulse rounded-lg bg-gray-100`} />;

// The chart library draws on a canvas, so it can't render on the server.
const InsightChart = dynamic(() => import("@/components/coin/InsightChart"), {
  ssr: false,
  loading: ChartSkeleton,
});

type Props = {
  coinId: string;
  // The profile's live price; the chart ends on it so both always agree.
  livePrice?: number | null;
  liveUpdatedAt?: string | null;
};

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="truncate text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

export default function CryptoChart({ coinId, livePrice, liveUpdatedAt }: Props) {
  const [selected, setSelected] = useState<ChartRange>("7d");
  // The chart stays clean until asked: a stored result only shows after a click,
  // and stays on while switching between analyzed ranges if that one is already there.
  const [analysisOn, setAnalysisOn] = useState(false);
  // History stays in USD; only the labels are converted.
  const { money } = useDisplayCurrency();
  const { series: history, isPrevious, isLoading, isValidating, isError, retry } = useCoinChart(coinId, selected);

  const series = useMemo(
    () => (history ? withLivePrice(history, livePrice, liveUpdatedAt) : null),
    [history, livePrice, liveUpdatedAt],
  );
  const summary = useMemo(() => (series ? summarizeSeries(series) : null), [series]);

  const range = CHART_RANGES.find((option) => option.value === selected) ?? CHART_RANGES[1];
  const isUp = (summary?.changePct ?? 0) >= 0;
  // keepPreviousData shows the old range while a new one loads.
  const isSwitching = summary !== null && isPrevious;
  // The new range failed: say so, rather than showing the old one under its name.
  const showFailure = isError && !isLoading && (series === null || isPrevious);

  // Analysis only exists for candle ranges on the allowed coins.
  const timeframe = insightTimeframe(selected);
  const isCandles = series?.kind === "candles";
  const allowed = isCandles && series.analysisAllowed;
  const cachedInsight = useCachedInsight(coinId, allowed ? timeframe : null);
  const { run, isRunning, error: runError, reset: resetRun } = useRunInsight(coinId, timeframe);
  const { toggles, toggle } = useInsightToggles();
  const now = useNow();

  const insight = analysisOn && !isSwitching && cachedInsight?.timeframe === timeframe ? cachedInsight : null;
  const isFresh = cachedInsight ? isInsightFresh(cachedInsight, now) : false;
  const showPanel = insight !== null || (analysisOn && isRunning);

  const paneCount = insight ? Number(toggles.rsi) + Number(toggles.volume) : 0;
  const paneStyle = { "--panes": `${paneCount * PANE_HEIGHT_PX}px` } as CSSProperties;

  const analyze = async () => {
    setAnalysisOn(true);

    if (cachedInsight && isFresh) return;

    // An old failure shouldn't stay on screen during the retry.
    resetRun();

    const result = await run();

    // Nothing to show, and the message below says why.
    if (!result) setAnalysisOn(false);
  };

  const refresh = () => {
    resetRun();
    run();
  };

  const selectRange = (next: ChartRange) => {
    resetRun();
    setSelected(next);
  };

  return (
    <section className="w-full rounded-xl bg-card p-3 shadow-sm ring-1 ring-foreground/10 sm:p-5">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-gray-900 sm:text-lg">
            Price Chart
          </h2>

          {summary && !showFailure ? (
            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-bold tracking-tight text-gray-900">
                {formatFiatPrice(summary.last, money)}
              </span>

              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  isUp ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
                }`}
              >
                {isUp ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                {Math.abs(summary.changePct).toFixed(2)}%
              </span>

              <span className="text-xs text-gray-500">{range.period}</span>
            </div>
          ) : (
            <div className="mt-2 h-7 w-48 animate-pulse rounded bg-gray-100" />
          )}
        </div>

        <div className="flex flex-wrap items-start justify-end gap-2">
          <TimeframeToggle value={selected} onChange={selectRange} />

          {allowed && timeframe && !insight && !isSwitching && (
            <AnalyzeButton isRunning={isRunning} isReady={Boolean(cachedInsight && isFresh)} onClick={analyze} />
          )}
        </div>
      </div>

      {/* Longer ranges are candles too, but can't be analyzed for any coin. */}
      {timeframe && isCandles && !allowed && !isSwitching && (
        <p className="mb-3 text-[11px] text-muted-foreground">AI analysis available for top coins.</p>
      )}

      {/* Announces the result, which otherwise appears silently off to one side. */}
      <p role="status" className="sr-only">
        {insight ? `Analysis ready. ${insight.ai ? `Outlook ${insight.ai.label}.` : "AI outlook not available."}` : ""}
      </p>

      {runError && (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {runError.status === 429
            ? `Too many requests, try again in ${runError.retryAfter ?? 60} seconds.`
            : "Couldn't run the analysis just now. The chart is still here, so please try again."}
        </p>
      )}

      <div className={showPanel ? "grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_17rem]" : undefined}>
        <div className="min-w-0">
          {/* Chart */}
          {series && summary && !showFailure ? (
            <div
              style={paneStyle}
              className="relative h-[calc(300px+var(--panes,0px))] w-full transition-[height] duration-300 motion-reduce:transition-none sm:h-[calc(380px+var(--panes,0px))]"
            >
              {isSwitching && (
                <div className="absolute inset-0 z-20 flex items-center justify-center rounded-lg bg-white/60">
                  <RefreshCw className="h-5 w-5 animate-spin text-gray-400" aria-label="Loading" />
                </div>
              )}

              <InsightChart
                series={series}
                range={selected}
                money={money}
                isUp={isUp}
                insight={insight}
                toggles={toggles}
                label={`${coinId} price chart, ${range.period}. Latest ${formatFiatPrice(summary.last, money)}, low ${formatFiatPrice(summary.low, money)}, high ${formatFiatPrice(summary.high, money)}.${insight ? ` ${nearestLevelsText(insight.zones, money)}` : ""}`}
              />
            </div>
          ) : showFailure ? (
            <div className={`flex ${CHART_HEIGHT} flex-col items-center justify-center gap-2 text-center`}>
              <p className="text-sm font-medium text-gray-700">
                Chart data is temporarily unavailable
              </p>
              <p className="text-xs text-gray-500">
                We&apos;ll keep retrying automatically.
              </p>
              <button
                type="button"
                onClick={retry}
                disabled={isValidating}
                className="mt-1 inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? "animate-spin" : ""}`} />
                Try again
              </button>
            </div>
          ) : (
            <ChartSkeleton />
          )}

          {insight && (
            <div className="mt-3 flex flex-col gap-2">
              <IndicatorToggles toggles={toggles} onToggle={toggle} onClear={() => setAnalysisOn(false)} />

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                {now > 0 && <span>Analyzed {formatRelativeTime(insight.analyzedAt, now)}</span>}

                {!isFresh && (
                  <button
                    type="button"
                    onClick={refresh}
                    disabled={isRunning}
                    className="inline-flex items-center gap-1 font-semibold text-gray-700 underline hover:text-gray-900 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-3 w-3 ${isRunning ? "animate-spin" : ""}`} aria-hidden="true" />
                    Refresh analysis
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Range stats */}
          {summary && !showFailure && (
            <div className="mt-4 grid grid-cols-3 gap-3 border-t pt-4">
              <Stat label={`${range.label} Low`} value={formatFiatPrice(summary.low, money)} />
              <Stat label={`${range.label} High`} value={formatFiatPrice(summary.high, money)} />
              <Stat label="24h Volume" value={formatFiatCompact(summary.latestVolume, money)} />
            </div>
          )}
        </div>

        {showPanel && (
          <aside
            aria-label="Analysis"
            className="flex flex-col gap-4 border-t pt-4 animate-in fade-in duration-300 motion-reduce:animate-none lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"
          >
            {insight ? (
              <>
                <KeyLevelsTable zones={insight.zones} money={money} timeframe={insight.timeframe} />
                <AiOutlookPanel insight={insight} />
                <NewsPinList pins={insight.newsPins} />
              </>
            ) : (
              <div aria-busy="true" aria-label="Analyzing chart" className="flex flex-col gap-2">
                <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
                <div className="h-24 animate-pulse rounded bg-gray-100" />
                <div className="h-4 w-24 animate-pulse rounded bg-gray-100" />
                <div className="h-32 animate-pulse rounded bg-gray-100" />
              </div>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}
