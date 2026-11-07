"use client";

import { useEffect, useRef, useState } from "react";
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  HistogramSeries,
  LineSeries,
  LineStyle,
  TrackingModeExitMode,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type SeriesMarkerShape,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import { ZonesPrimitive } from "@/components/coin/zonesPrimitive";
import { useIsDark } from "@/hooks/useIsDark";
import { chartMinMove, formatChartTick, formatChartTime } from "@/lib/chartSeries";
import { LABEL_TEXT } from "@/lib/formatNews";
import { higherTimeframeTag, pinsOnCandles, snapToCandles } from "@/lib/insight";
import { formatFiatAxis, formatFiatCompact, formatFiatPrice, type Money } from "@/lib/money";
import type { ChartRange, ChartSeries } from "@/types/chart";
import type { InsightToggles, NewsPin, PriceInsight } from "@/types/insight";
import type { SentimentLabel } from "@/types/news";

const UP_COLOR = "#16a34a";
const DOWN_COLOR = "#ef4444";

// Keeps the volume bars in the lowest part of the plot, under the price.
const VOLUME_MARGINS = { top: 0.82, bottom: 0 };
const PRICE_MARGINS = { top: 0.08, bottom: 0.22 };
// Without volume underneath, the price can use the whole pane.
const FULL_PRICE_MARGINS = { top: 0.08, bottom: 0.08 };
const VOLUME_PANE_MARGINS = { top: 0.1, bottom: 0 };

const EMA_FAST_COLOR = "#3b82f6";
const EMA_SLOW_COLOR = "#f59e0b";
const RSI_COLOR = "#8b5cf6";
const RSI_LEVELS = [70, 30];

const PIN_SHAPES: Record<SentimentLabel, SeriesMarkerShape> = {
  bullish: "arrowUp",
  neutral: "circle",
  bearish: "arrowDown",
};

const PIN_COLORS: Record<SentimentLabel, string> = {
  bullish: UP_COLOR,
  neutral: "#64748b",
  bearish: DOWN_COLOR,
};

const FADE_MS = 300;

// A wide price pane, with the indicator panes under it taking one share each.
const MAIN_PANE_SHARE = 4;

type Props = {
  series: ChartSeries;
  range: ChartRange;
  money: Money;
  isUp: boolean;
  label: string;
  // Set while an analysis is on screen.
  insight?: PriceInsight | null;
  toggles?: InsightToggles;
};

type MainSeries = ISeriesApi<"Candlestick"> | ISeriesApi<"Area">;

type Hover = {
  pin: NewsPin | null;
  time: number;
  ohlc: { open: number; high: number; low: number; close: number } | null;
  price: number | null;
  volume: number | null;
};

/**
 * Canvas can't read CSS variables, and the theme's are in oklch, so paint the
 * color once and read the pixel back as plain rgb.
 */
function themeColor(variable: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  const context = document.createElement("canvas").getContext("2d", { willReadFrequently: true });

  if (!context || !value) return "#888888";

  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);

  const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;

  return `rgb(${red}, ${green}, ${blue})`;
}

const toTime = (time: number) => time as UTCTimestamp;

const toHexAlpha = (opacity: number) => Math.round(opacity * 255).toString(16).padStart(2, "0");

/** Runs `step` from 0 to 1 once, or jumps to 1 for visitors who prefer less motion. */
function fadeIn(step: (progress: number) => void): () => void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    step(1);
    return () => {};
  }

  const start = performance.now();
  let frame = 0;

  const tick = (now: number) => {
    // The first frame's timestamp can be slightly earlier than `start`.
    const progress = Math.min(Math.max((now - start) / FADE_MS, 0), 1);
    step(progress);
    if (progress < 1) frame = requestAnimationFrame(tick);
  };

  frame = requestAnimationFrame(tick);

  return () => cancelAnimationFrame(frame);
}

/**
 * The price chart itself. Client-only, since the library needs a real canvas;
 * load it through next/dynamic.
 */
export default function InsightChart({ series, range, money, isUp, label, insight = null, toggles }: Props) {
  const dark = useIsDark();
  const [hover, setHover] = useState<Hover | null>(null);
  const hoverPrice = (value: number | null) => formatFiatPrice(value === null ? null : value / money.rate, money);

  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const mainRef = useRef<{ kind: ChartSeries["kind"]; api: MainSeries } | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const baseLineRef = useRef<IPriceLine | null>(null);
  // Which analysis has already faded in, so a redraw doesn't replay it.
  const fadedRef = useRef<string | null>(null);
  // The pins on screen, by marker id, for the chart's hover and click events.
  const pinsRef = useRef<Record<string, NewsPin>>({});

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const chart = createChart(container, {
      autoSize: true,
      // The range buttons pick what's shown. Letting the chart pan and zoom
      // would also take over page scrolling on the wheel and on touch.
      handleScroll: false,
      handleScale: false,
      // By default a long press's readout stays until the next tap, covering
      // much of the chart on a phone.
      trackingMode: { exitMode: TrackingModeExitMode.OnTouchEnd },
      rightPriceScale: { borderVisible: false, scaleMargins: PRICE_MARGINS },
      timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
    });

    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: "",
      priceLineVisible: false,
      lastValueVisible: false,
    });

    volume.priceScale().applyOptions({ scaleMargins: VOLUME_MARGINS });

    chart.subscribeCrosshairMove((param) => {
      const main = mainRef.current;

      if (!param.time || !main) {
        setHover(null);
        return;
      }

      const point = param.seriesData.get(main.api);
      const bar = param.seriesData.get(volume);

      setHover({
        pin: pinsRef.current[String(param.hoveredObjectId)] ?? null,
        time: param.time as number,
        ohlc: point && "close" in point ? { open: point.open, high: point.high, low: point.low, close: point.close } : null,
        price: point && "value" in point ? point.value : null,
        volume: bar && "value" in bar ? bar.value : null,
      });
    });

    // On a wide screen the mouse can open a story from its pin. On touch, a tap
    // meant for the chart shouldn't leave the page: the list below has the links.
    chart.subscribeClick((param) => {
      const pin = pinsRef.current[String(param.hoveredObjectId)];

      if (pin && window.matchMedia("(hover: hover)").matches) {
        window.open(pin.url, "_blank", "noopener,noreferrer");
      }
    });

    // Every candle always stays in view, so a new width (the analysis panel
    // opening, a rotated phone) has to refit them. Left alone, the newest
    // candles would be cut off. Waits a frame for the chart's own resize.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => chart.timeScale().fitContent());
    });

    observer.observe(container);

    chartRef.current = chart;
    volumeRef.current = volume;

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      chart.remove();
      chartRef.current = null;
      volumeRef.current = null;
      mainRef.current = null;
      baseLineRef.current = null;
      fadedRef.current = null;
    };
  }, []);

  // Colors are repainted from the theme's own variables on every switch.
  useEffect(() => {
    chartRef.current?.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: themeColor("--chart-axis"),
        fontFamily: getComputedStyle(document.body).fontFamily,
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: themeColor("--chart-grid") },
      },
    });

    volumeRef.current?.applyOptions({ color: themeColor("--chart-volume") });
  }, [dark]);

  useEffect(() => {
    const chart = chartRef.current;
    const volume = volumeRef.current;

    if (!chart || !volume) return;

    if (mainRef.current && mainRef.current.kind !== series.kind) {
      chart.removeSeries(mainRef.current.api);
      mainRef.current = null;
      baseLineRef.current = null;
    }

    const lineColor = isUp ? UP_COLOR : DOWN_COLOR;

    // Prices are plotted in the display currency, so the scale picks round
    // steps in it. Converting only the labels would give ticks like ₱153.76K.
    const toDisplay = (usd: number) => usd * money.rate;
    const fromDisplay = (value: number) => value / money.rate;

    let main = mainRef.current?.api ?? null;

    if (series.kind === "candles") {
      const candles = (main as ISeriesApi<"Candlestick"> | null) ?? chart.addSeries(CandlestickSeries, {
        upColor: UP_COLOR,
        downColor: DOWN_COLOR,
        wickUpColor: UP_COLOR,
        wickDownColor: DOWN_COLOR,
        borderVisible: false,
      });

      candles.setData(series.candles.map((candle) => ({
        time: toTime(candle.time),
        open: toDisplay(candle.open),
        high: toDisplay(candle.high),
        low: toDisplay(candle.low),
        close: toDisplay(candle.close),
      })));
      main = candles;
    } else {
      const area = (main as ISeriesApi<"Area"> | null) ?? chart.addSeries(AreaSeries, { lineWidth: 2 });

      area.setData(series.line.map((point) => ({ time: toTime(point.time), value: toDisplay(point.value) })));
      area.applyOptions({
        lineColor,
        topColor: `${lineColor}40`,
        bottomColor: `${lineColor}00`,
      });
      main = area;
    }

    mainRef.current = { kind: series.kind, api: main };
    volume.setData(series.volume.map((point) => ({ ...point, time: toTime(point.time) })));

    const prices = series.kind === "candles"
      ? series.candles.map((candle) => candle.close)
      : series.line.map((point) => point.value);

    const first = series.kind === "candles" ? series.candles[0]?.open : series.line[0]?.value;
    const last = prices[prices.length - 1] ?? 0;

    main.applyOptions({
      priceFormat: {
        type: "custom",
        minMove: chartMinMove(toDisplay(last)),
        formatter: (value: number) => formatFiatPrice(fromDisplay(value), money),
        tickmarksFormatter: (values: readonly number[]) => values.map((value) => formatFiatAxis(fromDisplay(value), money)),
      },
    });

    // Where the period started, to read the change at a glance.
    if (baseLineRef.current) {
      main.removePriceLine(baseLineRef.current);
      baseLineRef.current = null;
    }

    if (first !== undefined) {
      baseLineRef.current = main.createPriceLine({
        price: toDisplay(first),
        color: themeColor("--chart-axis"),
        lineStyle: LineStyle.Dotted,
        lineWidth: 1,
        axisLabelVisible: false,
      });
    }

    chart.applyOptions({
      localization: {
        locale: "en-US",
        timeFormatter: (time: Time) => formatChartTime(time as number, range),
      },
      timeScale: {
        timeVisible: range === "1d",
        tickMarkFormatter: (time: Time) => formatChartTick(time as number, range),
      },
    });

    chart.timeScale().fitContent();
  }, [series, range, money, isUp, dark]);

  // The analysis on top of the plain chart. Rebuilt whole when anything changes:
  // these are few series, and it keeps every toggle combination simple.
  useEffect(() => {
    const chart = chartRef.current;
    const main = mainRef.current?.api;
    const volume = volumeRef.current;

    if (!chart || !main || !volume) return;

    const shown = insight && toggles ? toggles : null;
    const times = series.kind === "candles" ? series.candles.map((candle) => candle.time) : [];
    const toDisplay = (usd: number) => usd * money.rate;
    const fromDisplay = (value: number) => value / money.rate;

    const key = insight ? `${insight.coinId}:${insight.timeframe}:${insight.analyzedAt}` : null;
    const shouldFade = key !== null && fadedRef.current !== key;
    fadedRef.current = key;

    const emaSeries: { line: ISeriesApi<"Line">; color: string }[] = [];
    let zones: ZonesPrimitive | null = null;
    let rsi: ISeriesApi<"Line"> | null = null;

    if (insight && shown?.sr && insight.zones.length > 0) {
      zones = new ZonesPrimitive(
        insight.zones.map((zone) => ({
          label: [zone.id, zone.testing ? "price testing" : zone.strength, higherTimeframeTag(zone, insight.timeframe)]
            .filter(Boolean)
            .join(" · "),
          isResistance: zone.type === "resistance",
          from: toDisplay(zone.from),
          to: toDisplay(zone.to),
        })),
        { text: themeColor("--foreground"), labelBackground: themeColor("--card") },
      );
      main.attachPrimitive(zones);
    }

    if (insight && shown?.ma) {
      const lines = [
        { title: "EMA20", color: EMA_FAST_COLOR, points: insight.ema20 },
        { title: "EMA50", color: EMA_SLOW_COLOR, points: insight.ema50 },
      ];

      for (const { title, color, points } of lines) {
        const snapped = snapToCandles(points, times);

        // 1D has no EMA50: too few candles on the free tier.
        if (snapped.length === 0) continue;

        const line = chart.addSeries(LineSeries, {
          color,
          title,
          lineWidth: 2,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
          priceFormat: {
            type: "custom",
            minMove: chartMinMove(toDisplay(snapped[snapped.length - 1].value)),
            formatter: (value: number) => formatFiatPrice(fromDisplay(value), money),
          },
        });

        line.setData(snapped.map((point) => ({ time: toTime(point.time), value: toDisplay(point.value) })));
        emaSeries.push({ line, color });
      }
    }

    // Shape and color both carry the story's sentiment, so color is never alone.
    const pins = insight ? pinsOnCandles(insight.newsPins, times) : [];

    pinsRef.current = Object.fromEntries(pins.map((pin, index) => [`pin-${index}`, pin]));

    const markers = pins.length > 0
      ? createSeriesMarkers(main, pins.map((pin, index) => ({
          id: `pin-${index}`,
          time: toTime(pin.time),
          position: pin.label === "bearish" ? ("aboveBar" as const) : ("belowBar" as const),
          shape: PIN_SHAPES[pin.label],
          color: PIN_COLORS[pin.label],
          size: 0.8,
        })))
      : null;

    let nextPane = 1;

    if (insight && shown?.rsi) {
      const snapped = snapToCandles(insight.rsi, times);

      if (snapped.length > 0) {
        rsi = chart.addSeries(LineSeries, {
          color: RSI_COLOR,
          title: "RSI 14",
          lineWidth: 2,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
          priceFormat: { type: "custom", minMove: 0.01, formatter: (value: number) => value.toFixed(0) },
          // A fixed scale, so 70 and 30 always sit in the same place.
          autoscaleInfoProvider: () => ({ priceRange: { minValue: 0, maxValue: 100 } }),
        }, nextPane);

        rsi.setData(snapped.map((point) => ({ time: toTime(point.time), value: point.value })));

        for (const price of RSI_LEVELS) {
          rsi.createPriceLine({
            price,
            color: themeColor("--chart-axis"),
            lineStyle: LineStyle.Dotted,
            lineWidth: 1,
            axisLabelVisible: true,
            title: "",
          });
        }

        nextPane++;
      }
    }

    // The plain chart has volume under the price. An analysis gives it its
    // own pane, or hides it when its toggle is off.
    const volumeInPane = Boolean(insight && shown?.volume);
    const volumeHidden = Boolean(insight && !shown?.volume);

    volume.applyOptions({
      visible: !volumeHidden,
      priceScaleId: volumeInPane ? "right" : "",
      title: volumeInPane ? "24h volume" : "",
      lastValueVisible: volumeInPane,
      priceFormat: {
        type: "custom",
        minMove: 1,
        formatter: (usd: number) => formatFiatCompact(usd, money),
      },
    });
    volume.moveToPane(volumeInPane ? nextPane : 0);
    volume.priceScale().applyOptions({ scaleMargins: volumeInPane ? VOLUME_PANE_MARGINS : VOLUME_MARGINS });

    chart.priceScale("right", 0).applyOptions({ scaleMargins: insight ? FULL_PRICE_MARGINS : PRICE_MARGINS });

    chart.panes().forEach((pane, index) => pane.setStretchFactor(index === 0 ? MAIN_PANE_SHARE : 1));

    const applyOpacity = (opacity: number) => {
      zones?.setOpacity(opacity);
      emaSeries.forEach(({ line, color }) => line.applyOptions({ color: `${color}${toHexAlpha(opacity)}` }));
      rsi?.applyOptions({ color: `${RSI_COLOR}${toHexAlpha(opacity)}` });
    };

    const stopFade = shouldFade ? fadeIn(applyOpacity) : () => {};

    // Panes change the shape of the plot, and series change the time scale.
    chart.timeScale().fitContent();

    return () => {
      stopFade();

      // On unmount the chart's own cleanup runs first and removes everything
      // with it. Touching its series after that throws, and Next would show
      // its error page instead of the page being opened.
      if (chartRef.current !== chart) return;

      markers?.detach();
      if (zones) main.detachPrimitive(zones);
      emaSeries.forEach(({ line }) => chart.removeSeries(line));
      if (rsi) chart.removeSeries(rsi);
    };
  }, [insight, toggles, series, money, dark]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} role="img" aria-label={label} className="h-full w-full" />

      {hover && (
        <div className="pointer-events-none absolute left-0 top-0 z-10 max-w-full rounded-lg bg-white/90 px-2 py-1 text-[11px] text-gray-500 shadow-sm backdrop-blur">
          <p className="font-medium">{formatChartTime(hover.time, range)}</p>

          {hover.pin && (
            <p className="my-0.5 max-w-xs">
              <span className="font-semibold text-gray-900">{hover.pin.headline}</span>
              {" · "}
              {hover.pin.source} · {LABEL_TEXT[hover.pin.label]}
            </p>
          )}

          <p className="flex flex-wrap gap-x-2 font-semibold text-gray-900">
            {hover.ohlc ? (
              <>
                <span><span className="font-normal text-gray-500">O</span> {hoverPrice(hover.ohlc.open)}</span>
                <span><span className="font-normal text-gray-500">H</span> {hoverPrice(hover.ohlc.high)}</span>
                <span><span className="font-normal text-gray-500">L</span> {hoverPrice(hover.ohlc.low)}</span>
                <span><span className="font-normal text-gray-500">C</span> {hoverPrice(hover.ohlc.close)}</span>
              </>
            ) : (
              <span>{hoverPrice(hover.price)}</span>
            )}

            {hover.volume !== null && (
              <span><span className="font-normal text-gray-500">24h Vol</span> {formatFiatCompact(hover.volume, money)}</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
