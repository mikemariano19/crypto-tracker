import type {
  AutoscaleInfo,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
  Time,
} from "lightweight-charts";

export type DrawnZone = {
  label: string;
  isResistance: boolean;
  /** In the plotted currency. */
  from: number;
  to: number;
};

type ZoneColors = { text: string; labelBackground: string };

// A tint, so candles stay readable on top. Each zone also carries a text
// label: color alone never says which one is which.
const RESISTANCE = "239, 68, 68";
const SUPPORT = "22, 163, 74";

const FILL_ALPHA = 0.14;
const EDGE_ALPHA = 0.4;

const LABEL_FONT_PX = 10;
const LABEL_PADDING_PX = 3;
const LABEL_INSET_PX = 4;

type DrawTarget = Parameters<IPrimitivePaneRenderer["draw"]>[0];

/**
 * Draws support and resistance as shaded bands. A primitive rather than HTML
 * on top, so the bands can't drift from the price scale. The bands sit behind
 * the candles; their labels sit in front, or a candle could hide them.
 */
export class ZonesPrimitive implements ISeriesPrimitive<Time> {
  private series: ISeriesApi<SeriesType> | null = null;
  private requestUpdate: (() => void) | null = null;
  private opacity = 1;

  private readonly views: IPrimitivePaneView[] = [
    { zOrder: () => "bottom", renderer: () => ({ draw: (target) => this.drawBands(target) }) },
    { zOrder: () => "top", renderer: () => ({ draw: (target) => this.drawLabels(target) }) },
  ];

  constructor(private readonly zones: DrawnZone[], private readonly colors: ZoneColors) {}

  attached({ series, requestUpdate }: SeriesAttachedParameter<Time>) {
    this.series = series;
    this.requestUpdate = requestUpdate;
  }

  detached() {
    this.series = null;
    this.requestUpdate = null;
  }

  setOpacity(opacity: number) {
    this.opacity = opacity;
    this.requestUpdate?.();
  }

  paneViews() {
    return this.views;
  }

  /** Keeps every zone on screen, even one just outside the candles' range. */
  autoscaleInfo(): AutoscaleInfo | null {
    if (this.zones.length === 0) return null;

    return {
      priceRange: {
        minValue: Math.min(...this.zones.map((zone) => zone.from)),
        maxValue: Math.max(...this.zones.map((zone) => zone.to)),
      },
    };
  }

  private drawBands(target: DrawTarget) {
    const series = this.series;

    if (!series) return;

    target.useBitmapCoordinateSpace(({ context, bitmapSize, verticalPixelRatio }) => {
      const edge = Math.max(1, Math.round(verticalPixelRatio));

      context.globalAlpha = this.opacity;

      for (const zone of this.zones) {
        const top = series.priceToCoordinate(zone.to);
        const bottom = series.priceToCoordinate(zone.from);

        if (top === null || bottom === null) continue;

        const y = Math.round(top * verticalPixelRatio);
        // Thin enough to vanish otherwise on a wide price range.
        const height = Math.max(Math.round((bottom - top) * verticalPixelRatio), edge * 2);
        const color = zone.isResistance ? RESISTANCE : SUPPORT;

        context.fillStyle = `rgba(${color}, ${FILL_ALPHA})`;
        context.fillRect(0, y, bitmapSize.width, height);

        context.fillStyle = `rgba(${color}, ${EDGE_ALPHA})`;
        context.fillRect(0, y, bitmapSize.width, edge);
        context.fillRect(0, y + height, bitmapSize.width, edge);
      }

      context.globalAlpha = 1;
    });
  }

  private drawLabels(target: DrawTarget) {
    const series = this.series;

    if (!series) return;

    target.useBitmapCoordinateSpace(({ context, verticalPixelRatio, horizontalPixelRatio }) => {
      const padding = Math.round(LABEL_PADDING_PX * horizontalPixelRatio);
      const lineHeight = Math.round((LABEL_FONT_PX + LABEL_PADDING_PX) * verticalPixelRatio);
      const x = Math.round(LABEL_INSET_PX * horizontalPixelRatio);

      context.globalAlpha = this.opacity;
      context.font = `600 ${Math.round(LABEL_FONT_PX * verticalPixelRatio)}px sans-serif`;
      context.textBaseline = "top";

      for (const zone of this.zones) {
        const top = series.priceToCoordinate(zone.to);

        if (top === null) continue;

        const y = Math.round(top * verticalPixelRatio) + Math.round(verticalPixelRatio);
        const width = context.measureText(zone.label).width + padding * 2;

        context.fillStyle = this.colors.labelBackground;
        context.fillRect(x, y, width, lineHeight);

        context.fillStyle = this.colors.text;
        context.fillText(zone.label, x + padding, y + Math.round(verticalPixelRatio));
      }

      context.globalAlpha = 1;
    });
  }
}
