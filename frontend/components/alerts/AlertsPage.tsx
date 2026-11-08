"use client";

import Link from "next/link";
import { useId } from "react";
import { BellOff, BellRing, Inbox, Moon, ShieldCheck } from "lucide-react";
import { CategoryIcon, PriceAlertRow, Switch } from "@/components/alerts/AlertParts";
import PushNotice from "@/components/alerts/PushNotice";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useNow } from "@/hooks/useNow";
import { usePushAlerts } from "@/hooks/usePushAlerts";
import { useWatchCoins } from "@/hooks/useWatchCoins";
import { alertLabel, formatInCurrency } from "@/lib/alertFormat";
import { formatRelativeTime } from "@/lib/formatNews";
import { cn } from "@/lib/utils";
import type { PushCategory, PushPrefs } from "@/types/push";

const CATEGORIES: { key: PushCategory; label: string; hint: string }[] = [
  { key: "price", label: "Price alerts", hint: "When a coin reaches a price you set. Set them with the bell on any coin." },
  {
    key: "moves",
    label: "Big moves on your coins",
    hint: "When a favorite or wallet coin moves 8% in 4 hours, or breaks through a well-tested support or resistance level.",
  },
  { key: "market", label: "Market drop or rally", hint: "When the whole market moves 5% in a day, or BTC 7% in 4 hours." },
  { key: "news", label: "Breaking news", hint: "High-impact stories and shifts in overall news sentiment, at most 2 a day." },
  { key: "brief", label: "Daily brief", hint: "Market move, news sentiment and big stories, once a day." },
];

const DEFAULT_CATEGORIES: Record<PushCategory, boolean> = { price: true, moves: false, market: false, news: false, brief: false };

/** Which coins "Big moves" covers, so it's clear what the server is told. */
function watchHint(coins: string[] | null): string | null {
  if (coins === null) return null;
  if (coins.length === 0) return "You have no favorites or wallet coins yet. Star a coin or add one to a wallet to use this.";

  return `Watching ${coins.length} ${coins.length === 1 ? "coin" : "coins"} from your favorites and wallets. Only the coin names are shared, never amounts.`;
}

function Card({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-200 sm:p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          {Icon && <Icon className="h-4 w-4 text-gray-500" aria-hidden="true" />}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function CategoryRow({
  category,
  label,
  hint,
  checked,
  disabled,
  onChange,
  children,
}: {
  category: PushCategory;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  children?: React.ReactNode;
}) {
  const id = useId();

  return (
    <li className="py-3.5">
      <div className="flex items-start gap-3">
        <CategoryIcon category={category} className={cn(!checked && "opacity-60")} />
        <div className="min-w-0 flex-1">
          {/* The whole text toggles too, so the target isn't only the small switch. */}
          <button type="button" onClick={() => onChange(!checked)} disabled={disabled} tabIndex={-1} className="block w-full cursor-pointer text-left disabled:cursor-not-allowed">
            <span id={`${id}-label`} className="block text-sm font-semibold text-gray-900">{label}</span>
            <span id={`${id}-hint`} className="mt-0.5 block text-xs leading-relaxed text-gray-600">{hint}</span>
          </button>
        </div>
        <Switch checked={checked} disabled={disabled} onChange={onChange} labelledBy={`${id}-label`} describedBy={`${id}-hint`} />
      </div>
      {children && <div className="mt-3 pl-12">{children}</div>}
    </li>
  );
}

function TimeField({ label, value, onChange, disabled }: { label: string; value: string | null; onChange: (next: string) => void; disabled?: boolean }) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-gray-600">{label}</label>
      <input
        id={id}
        type="time"
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => event.target.value && onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm tabular-nums text-gray-900 outline-none focus-visible:border-gray-400 focus-visible:ring-3 focus-visible:ring-gray-200 disabled:opacity-50"
      />
    </div>
  );
}

/** Shown while alerts are off: what turning them on means, and the one button that does it. */
function TurnOnCard({ busy, onEnable }: { busy: boolean; onEnable: () => void }) {
  return (
    <section className="flex flex-col items-start gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200 sm:flex-row sm:items-center sm:p-6">
      <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gray-900 text-white">
        <BellRing className="h-6 w-6" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-gray-900">Get alerts on this device</h2>
        <p className="mt-1 text-sm text-gray-600">Your browser will ask to allow notifications. You can turn them off here any time.</p>
      </div>
      <button
        type="button"
        onClick={onEnable}
        disabled={busy}
        className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 disabled:opacity-60 sm:w-auto"
      >
        <BellRing className="h-4 w-4" aria-hidden="true" />
        {busy ? "Turning on…" : "Turn on alerts"}
      </button>
    </section>
  );
}

/**
 * Notification settings, the price alerts set on this browser and what was
 * sent. Nothing asks for permission until a switch or button is clicked.
 */
export default function AlertsPage() {
  const { code } = useDisplayCurrency();
  const { byCode } = useExchangeRates();
  const push = usePushAlerts(code);
  const watchCoins = useWatchCoins();
  const now = useNow();
  const prefs = push.state?.prefs;
  const isOn = push.status === "on";

  const save = (changes: Partial<PushPrefs>) => (isOn ? push.updatePrefs(changes) : push.enable(changes));

  const toggleCategory = (key: PushCategory, next: boolean) => {
    const categories = { ...(prefs?.categories ?? DEFAULT_CATEGORIES), [key]: next };

    // Big moves needs the watch list; WatchCoinsSync keeps it current after this.
    return save(key === "moves" && next && watchCoins ? { categories, watchCoins } : { categories });
  };

  const alerts = push.state?.alerts ?? [];
  const waiting = alerts.filter((alert) => !alert.triggeredAt);
  const hit = alerts.filter((alert) => alert.triggeredAt);
  const history = push.state?.history ?? [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 py-4 sm:py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Alerts</h1>
          <p className="mt-1 text-sm text-gray-600">Only what you turn on, at most 5 a day.</p>
        </div>
        {(isOn || push.status === "off") && (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
              isOn ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600",
            )}
          >
            <span className={cn("h-2 w-2 rounded-full", isOn ? "bg-emerald-500" : "bg-gray-400")} aria-hidden="true" />
            {isOn ? "On for this browser" : "Off"}
          </span>
        )}
      </header>

      <PushNotice status={push.status} />

      {push.error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{push.error}</p>}

      {push.status === "off" && <TurnOnCard busy={push.busy} onEnable={() => push.enable()} />}

      {(isOn || push.status === "off") && (
        <>
          <Card title="What to send">
            <ul className="divide-y divide-gray-100">
              {CATEGORIES.map(({ key, label, hint }) => (
                <CategoryRow
                  key={key}
                  category={key}
                  label={label}
                  hint={hint}
                  checked={isOn ? Boolean(prefs?.categories[key]) : false}
                  disabled={push.busy}
                  onChange={(next) => toggleCategory(key, next)}
                >
                  {isOn && key === "moves" && prefs?.categories.moves && watchHint(watchCoins) && (
                    <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">{watchHint(watchCoins)}</p>
                  )}
                  {isOn && key === "brief" && prefs?.categories.brief && (
                    <div className="max-w-[12rem]">
                      <TimeField label="Send it at" value={prefs.briefTime} disabled={push.busy} onChange={(briefTime) => save({ briefTime })} />
                    </div>
                  )}
                </CategoryRow>
              ))}
            </ul>
          </Card>

          {isOn && prefs && (
            <Card title="Quiet hours" icon={Moon}>
              <ul className="divide-y divide-gray-100">
                <QuietRow
                  label="Pause alerts overnight"
                  hint={`Times are on your clock (${prefs.timezone}). The daily brief still comes at its time.`}
                  checked={prefs.quietStart !== null}
                  disabled={push.busy}
                  onChange={(next) => save(next ? { quietStart: "23:00", quietEnd: "07:00" } : { quietStart: null, quietEnd: null })}
                />
                {prefs.quietStart !== null && (
                  <>
                    <li className="grid grid-cols-2 gap-3 py-3.5">
                      <TimeField label="From" value={prefs.quietStart} disabled={push.busy} onChange={(quietStart) => save({ quietStart })} />
                      <TimeField label="Until" value={prefs.quietEnd} disabled={push.busy} onChange={(quietEnd) => save({ quietEnd })} />
                    </li>
                    <QuietRow
                      label="Let my price alerts through"
                      hint="Alerts you set yourself still arrive during quiet hours."
                      checked={prefs.priceAlertsInQuiet}
                      disabled={push.busy}
                      onChange={(priceAlertsInQuiet) => save({ priceAlertsInQuiet })}
                    />
                  </>
                )}
              </ul>
            </Card>
          )}

          {isOn && (
            <Card
              title="Your price alerts"
              icon={BellRing}
              action={waiting.length > 0 && <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">{waiting.length} waiting</span>}
            >
              {alerts.length === 0 ? (
                <EmptyHint>
                  None yet. Open any coin and tap <span className="font-semibold text-gray-900">Alert</span> to set a target price.{" "}
                  <Link href="/" className="font-semibold text-gray-900 underline underline-offset-2">Browse coins</Link>
                </EmptyHint>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {[...waiting, ...hit].map((alert) => (
                    <PriceAlertRow
                      key={alert.id}
                      symbol={alert.symbol}
                      direction={alert.direction}
                      target={formatInCurrency(alert.threshold, alert.currency, byCode)}
                      hitAgo={alert.triggeredAt ? (now > 0 ? formatRelativeTime(alert.triggeredAt, now) : "") : null}
                      href={`/coin/${alert.coinId}`}
                      onRemove={() => push.removeAlert(alert.id)}
                      removeLabel={`Remove alert: ${alertLabel(alert, byCode)}`}
                      disabled={push.busy}
                    />
                  ))}
                </ul>
              )}
            </Card>
          )}

          {isOn && (
            <Card title="Recent alerts" icon={Inbox}>
              {history.length === 0 ? (
                <EmptyHint>Nothing sent yet. Alerts you get also show up here, in case you miss one.</EmptyHint>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {history.map((sent) => (
                    <li key={sent.id}>
                      <Link href={sent.url} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-gray-50">
                        <CategoryIcon category={sent.category} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-gray-900">{sent.title}</span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-gray-600">{sent.body}</span>
                        </span>
                        {now > 0 && <span className="shrink-0 text-[11px] text-gray-500">{formatRelativeTime(sent.sentAt, now)}</span>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          <p className="flex items-start gap-2 px-1 text-xs text-gray-500">
            <ShieldCheck className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
            No account. This browser holds the subscription; the server keeps only the coins and prices you pick.
          </p>

          {isOn && (
            <div className="flex justify-center border-t border-gray-200 pt-4 sm:justify-end">
              <button
                type="button"
                onClick={() => push.disable()}
                disabled={push.busy}
                className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
              >
                <BellOff className="h-4 w-4" aria-hidden="true" />
                Turn off all alerts on this browser
              </button>
            </div>
          )}
        </>
      )}

      {push.status === "loading" && (
        <div className="flex flex-col gap-4" aria-hidden="true">
          <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
          <div className="h-72 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      )}
    </div>
  );
}

function QuietRow({ label, hint, checked, disabled, onChange }: { label: string; hint: string; checked: boolean; disabled?: boolean; onChange: (next: boolean) => void }) {
  const id = useId();

  return (
    <li className="flex items-start justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <span id={`${id}-label`} className="block text-sm font-semibold text-gray-900">{label}</span>
        <span id={`${id}-hint`} className="mt-0.5 block text-xs leading-relaxed text-gray-600">{hint}</span>
      </div>
      <Switch checked={checked} disabled={disabled} onChange={onChange} labelledBy={`${id}-label`} describedBy={`${id}-hint`} />
    </li>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-gray-200 px-4 py-5 text-center text-sm text-gray-600">{children}</p>;
}
