"use client";

import Link from "next/link";
import { useId } from "react";
import { BellOff, BellRing, Trash2 } from "lucide-react";
import PushNotice from "@/components/alerts/PushNotice";
import { useDisplayCurrency } from "@/hooks/useDisplayCurrency";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { useNow } from "@/hooks/useNow";
import { usePushAlerts } from "@/hooks/usePushAlerts";
import { alertLabel } from "@/lib/alertFormat";
import { formatRelativeTime } from "@/lib/formatNews";
import type { PushCategory, PushPrefs } from "@/types/push";

const CATEGORIES: { key: PushCategory; label: string; hint: string }[] = [
  { key: "price", label: "Price alerts", hint: "When a coin reaches a price you set. Set them with the bell on any coin." },
  { key: "market", label: "Market drop or rally", hint: "When the whole market moves 5% in a day, or BTC 7% in 4 hours." },
  { key: "brief", label: "Daily brief", hint: "Market move, news sentiment and big stories, once a day." },
];

function Toggle({ checked, onChange, disabled, label, hint }: { checked: boolean; onChange: (next: boolean) => void; disabled?: boolean; label: string; hint?: string }) {
  const id = useId();

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-gray-900">{label}</span>
        {hint && <span className="mt-0.5 block text-xs text-gray-500">{hint}</span>}
      </label>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-5 w-9 shrink-0 cursor-pointer appearance-none rounded-full bg-gray-300 transition-colors before:block before:h-4 before:w-4 before:translate-x-0.5 before:rounded-full before:bg-white before:shadow before:transition-transform checked:bg-gray-900 checked:before:translate-x-[18px] disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
}

function TimeField({ label, value, onChange, disabled }: { label: string; value: string | null; onChange: (next: string) => void; disabled?: boolean }) {
  const id = useId();

  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="text-sm text-gray-700">{label}</label>
      <input
        id={id}
        type="time"
        value={value ?? ""}
        disabled={disabled}
        onChange={(event) => event.target.value && onChange(event.target.value)}
        className="h-9 rounded-lg border bg-white px-2 text-sm tabular-nums disabled:opacity-50"
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl bg-card p-4 shadow-sm ring-1 ring-foreground/10 sm:p-5">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-gray-500">{title}</h2>
      {children}
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
  const now = useNow();
  const prefs = push.state?.prefs;
  const isOn = push.status === "on";

  const save = (changes: Partial<PushPrefs>) => (isOn ? push.updatePrefs(changes) : push.enable(changes));

  const toggleCategory = (key: PushCategory, next: boolean) => {
    const categories = { ...(prefs?.categories ?? { price: true, market: false, brief: false }), [key]: next };

    return save({ categories });
  };

  const waiting = (push.state?.alerts ?? []).filter((alert) => !alert.triggeredAt);
  const hit = (push.state?.alerts ?? []).filter((alert) => alert.triggeredAt);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 py-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Alerts</h1>
        <p className="mt-1 text-sm text-gray-600">
          Only the notifications you turn on, at most 5 a day. No account: this browser holds the subscription, and the
          server keeps only the coins and prices you pick.
        </p>
      </div>

      <PushNotice status={push.status} />

      {push.error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{push.error}</p>}

      {(isOn || push.status === "off") && (
        <>
          <Section title="What to send">
            <div className="divide-y">
              {CATEGORIES.map(({ key, label, hint }) => (
                <Toggle
                  key={key}
                  label={label}
                  hint={hint}
                  checked={isOn ? Boolean(prefs?.categories[key]) : false}
                  disabled={push.busy}
                  onChange={(next) => toggleCategory(key, next)}
                />
              ))}
            </div>

            {isOn && prefs?.categories.brief && (
              <TimeField label="Send the brief at" value={prefs.briefTime} disabled={push.busy} onChange={(briefTime) => save({ briefTime })} />
            )}
          </Section>

          {isOn && prefs && (
            <Section title="Quiet hours">
              <Toggle
                label="Pause alerts overnight"
                hint={`Times are on your clock (${prefs.timezone}).`}
                checked={prefs.quietStart !== null}
                disabled={push.busy}
                onChange={(next) => save(next ? { quietStart: "23:00", quietEnd: "07:00" } : { quietStart: null, quietEnd: null })}
              />
              {prefs.quietStart !== null && (
                <>
                  <TimeField label="From" value={prefs.quietStart} disabled={push.busy} onChange={(quietStart) => save({ quietStart })} />
                  <TimeField label="Until" value={prefs.quietEnd} disabled={push.busy} onChange={(quietEnd) => save({ quietEnd })} />
                  <Toggle
                    label="Let my price alerts through"
                    hint="Alerts you set yourself still arrive during quiet hours."
                    checked={prefs.priceAlertsInQuiet}
                    disabled={push.busy}
                    onChange={(priceAlertsInQuiet) => save({ priceAlertsInQuiet })}
                  />
                </>
              )}
            </Section>
          )}

          {isOn && (
            <Section title="Your price alerts">
              {waiting.length === 0 && hit.length === 0 ? (
                <p className="py-2 text-sm text-gray-600">
                  None yet. Open a coin and tap the bell to set one. <Link href="/" className="font-medium underline">Browse coins</Link>
                </p>
              ) : (
                <ul className="divide-y">
                  {[...waiting, ...hit].map((alert) => (
                    <li key={alert.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                      <Link href={`/coin/${alert.coinId}`} className={alert.triggeredAt ? "text-gray-500 hover:underline" : "font-medium text-gray-900 hover:underline"}>
                        {alertLabel(alert, byCode)}
                      </Link>
                      <span className="flex items-center gap-2">
                        {alert.triggeredAt && now > 0 && <span className="text-xs text-gray-500">Hit {formatRelativeTime(alert.triggeredAt, now)}</span>}
                        <button
                          type="button"
                          onClick={() => push.removeAlert(alert.id)}
                          disabled={push.busy}
                          aria-label={`Remove alert: ${alertLabel(alert, byCode)}`}
                          className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          {isOn && (
            <Section title="Recent alerts">
              {(push.state?.history ?? []).length === 0 ? (
                <p className="py-2 text-sm text-gray-600">Nothing sent yet. Alerts you get also show up here, in case you miss one.</p>
              ) : (
                <ul className="divide-y">
                  {push.state!.history.map((sent) => (
                    <li key={sent.id} className="py-2.5">
                      <Link href={sent.url} className="block hover:underline">
                        <span className="block text-sm font-medium text-gray-900">{sent.title}</span>
                        <span className="block text-xs text-gray-600">{sent.body}</span>
                      </Link>
                      {now > 0 && <span className="text-[11px] text-gray-500">{formatRelativeTime(sent.sentAt, now)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          <div className="flex justify-end">
            {isOn ? (
              <button
                type="button"
                onClick={() => push.disable()}
                disabled={push.busy}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                <BellOff className="h-4 w-4" aria-hidden="true" />
                Turn off all alerts on this browser
              </button>
            ) : (
              <button
                type="button"
                onClick={() => push.enable()}
                disabled={push.busy}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60"
              >
                <BellRing className="h-4 w-4" aria-hidden="true" />
                Turn on alerts
              </button>
            )}
          </div>
        </>
      )}

      {push.status === "loading" && <div className="h-40 animate-pulse rounded-xl bg-gray-100" />}
    </div>
  );
}
