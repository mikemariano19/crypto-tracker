<?php

namespace App\Support\Push;

use App\Models\NewsCluster;
use App\Models\NewsSentimentSnapshot;
use App\Models\PriceAlert;
use App\Models\PushNotification;
use App\Models\PushSubscription;
use App\Support\MarketData;
use App\Support\PriceCache;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

/**
 * One pass over every alert: price alerts, big moves and level breaks on
 * watched coins, market drop or rally, breaking news and mood shifts, and the
 * daily brief. Plain code and cached data only, no AI. Runs every 10 minutes
 * from the scheduler, and from an external scheduler's call while the free
 * server would otherwise be asleep; the lock keeps them from overlapping.
 */
class PushCheck
{
    // A price older than this could fire an alert the market has moved past.
    private const MAX_PRICE_AGE_SECONDS = 900;

    private const LOCK_SECONDS = 300;

    private const SAMPLES_KEY = 'push:price_samples';

    // 4-hour moves are measured against a sample from 3.5 to 4.5 hours ago.
    private const WINDOW_SECONDS = 14_400;

    private const WINDOW_SLACK_SECONDS = 1_800;

    // The run before only counts as "before" if it was this recent: after the
    // server slept, a level crossed hours ago is old news.
    private const PREVIOUS_MAX_AGE_SECONDS = 3_600;

    // Every distinct watched coin is priced each run, in one CoinGecko call.
    private const MAX_WATCHED_COINS = 250;

    public function __construct(
        private Notifier $notifier,
        private CoinMoves $moves,
        private NewsAlerts $news,
    ) {}

    /**
     * @return array{ran: bool, price: int, moves: int, market: int, news: int, brief: int}
     */
    public function run(): array
    {
        $lock = Cache::lock('push:check', self::LOCK_SECONDS);

        if (!$this->notifier->isConfigured() || !$lock->get()) {
            return ['ran' => false, 'price' => 0, 'moves' => 0, 'market' => 0, 'news' => 0, 'brief' => 0];
        }

        try {
            $alerts = PriceAlert::whereNull('triggered_at')->with('subscription')->get();
            $watchers = $this->watchers();

            $watched = $watchers->pluck('watch_coins')->flatten()->unique()->take(self::MAX_WATCHED_COINS);

            // One price call covers price alerts, watched coins and BTC.
            $ids = collect(['bitcoin'])->merge($alerts->pluck('coin_id'))->merge($watched)->unique()->values()->all();

            $prices = $this->freshPrices(PriceCache::quotes($ids));
            [$changes, $previous] = $this->recordSamples($prices);

            $counts = [
                'ran' => true,
                'price' => $this->priceAlerts($alerts, $prices),
                'moves' => $this->moves->run($watchers, $prices, $changes, $previous),
                'market' => $this->marketAlert($changes['bitcoin'] ?? null),
                'news' => $this->news->run(),
                'brief' => $this->briefs(),
            ];

            $this->cleanUp();

            return $counts;
        } finally {
            $lock->release();
        }
    }

    /** @return Collection<int, PushSubscription> subscribers who want alerts about their own coins */
    private function watchers(): Collection
    {
        return PushSubscription::whereNotNull('watch_coins')->get()
            ->filter(fn (PushSubscription $subscription) => $subscription->wants('moves') && !empty($subscription->watch_coins))
            ->values();
    }

    /**
     * USD prices recent enough to act on.
     *
     * @return array<string, float>
     */
    private function freshPrices(array $quotes): array
    {
        $freshFrom = now()->getTimestamp() - self::MAX_PRICE_AGE_SECONDS;
        $prices = [];

        foreach ($quotes['data'] as $id => $quote) {
            if (is_numeric($quote['usd'] ?? null) && (float) $quote['usd'] > 0 && ($quotes['fetched_at'][$id] ?? 0) >= $freshFrom) {
                $prices[$id] = (float) $quote['usd'];
            }
        }

        return $prices;
    }

    /**
     * Each run leaves its prices behind, so a later run can see 4-hour moves
     * and what the price was on the run before.
     *
     * @param  array<string, float>  $prices
     * @return array{0: array<string, float>, 1: array<string, float>} % change over about 4 hours, and the previous run's price, per coin
     */
    private function recordSamples(array $prices): array
    {
        $now = now()->getTimestamp();
        $keepFrom = $now - self::WINDOW_SECONDS - self::WINDOW_SLACK_SECONDS;
        $kept = [];
        $changes = [];
        $previous = [];

        foreach (Cache::get(self::SAMPLES_KEY, []) as $coin => $samples) {
            $samples = array_values(array_filter($samples, fn (array $sample) => $sample[0] >= $keepFrom));

            if ($samples !== []) {
                $kept[$coin] = $samples;
            }
        }

        foreach ($prices as $coin => $usd) {
            $samples = $kept[$coin] ?? [];
            $best = null;

            foreach ($samples as [$time, $price]) {
                $offBy = abs($now - $time - self::WINDOW_SECONDS);

                if ($offBy <= self::WINDOW_SLACK_SECONDS && $price > 0 && ($best === null || $offBy < $best[0])) {
                    $best = [$offBy, $price];
                }
            }

            if ($best !== null) {
                $changes[$coin] = ($usd - $best[1]) / $best[1] * 100;
            }

            $last = $samples === [] ? null : $samples[count($samples) - 1];

            if ($last && $now - $last[0] <= self::PREVIOUS_MAX_AGE_SECONDS) {
                $previous[$coin] = $last[1];
            }

            $samples[] = [$now, $usd];
            $kept[$coin] = $samples;
        }

        Cache::put(self::SAMPLES_KEY, $kept, now()->addDay());

        return [$changes, $previous];
    }

    /**
     * @param  Collection<int, PriceAlert>  $alerts
     * @param  array<string, float>  $prices
     */
    private function priceAlerts(Collection $alerts, array $prices): int
    {
        if ($alerts->isEmpty()) {
            return 0;
        }

        $perUsd = MarketData::perUsd();
        $sent = 0;

        foreach ($alerts->groupBy('push_subscription_id') as $own) {
            $subscription = $own->first()->subscription;

            // Not allowed now (quiet hours, cap, turned off): the alerts wait.
            if (!$subscription || !$this->notifier->allows($subscription, 'price')) {
                continue;
            }

            $hits = [];

            foreach ($own as $alert) {
                $usd = $prices[$alert->coin_id] ?? null;
                $rate = $perUsd[$alert->currency] ?? null;

                if ($usd === null || !$rate) {
                    continue;
                }

                $price = $usd * $rate;

                if ($alert->isHitBy($price) && !$this->notifier->recentlyAlerted($subscription, $alert->coin_id)) {
                    $hits[] = [$alert, $price];
                }
            }

            if ($hits === []) {
                continue;
            }

            $coinIds = array_values(array_unique(array_map(fn (array $hit) => $hit[0]->coin_id, $hits)));

            if ($this->notifier->deliver($subscription, 'price', PushMessages::priceAlerts($hits), $coinIds)) {
                PriceAlert::whereIn('id', array_map(fn (array $hit) => $hit[0]->id, $hits))->update(['triggered_at' => now()]);
                $sent++;
            }
        }

        return $sent;
    }

    /**
     * Total market cap 5% either way in 24h, or BTC 7% in 4h. Sent once per
     * direction per cooldown, however long the move lasts.
     */
    private function marketAlert(?float $btc4h): int
    {
        $settings = config('push.market');
        $global = MarketData::remember('market_global');
        $market24h = is_numeric($global['change_24h'] ?? null) ? (float) $global['change_24h'] : null;

        $move = match (true) {
            $market24h !== null && abs($market24h) >= $settings['market_cap_24h_pct'] => ['kind' => 'market', 'pct' => $market24h],
            $btc4h !== null && abs($btc4h) >= $settings['btc_4h_pct'] => ['kind' => 'btc', 'pct' => $btc4h],
            default => null,
        };

        if ($move === null) {
            return 0;
        }

        $cooldownKey = 'push:market:' . ($move['pct'] < 0 ? 'down' : 'up');

        if (!Cache::add($cooldownKey, true, now()->addHours($settings['cooldown_hours']))) {
            return 0;
        }

        $coins = collect(MarketData::remember('coins') ?? [])->keyBy('id');
        $change = fn (string $id) => is_numeric($coins[$id]['price_change_percentage_24h'] ?? null)
            ? (float) $coins[$id]['price_change_percentage_24h']
            : null;

        $message = PushMessages::market($move, $market24h, $change('bitcoin'), $change('ethereum'));
        $sent = 0;

        foreach (PushSubscription::cursor() as $subscription) {
            if ($this->notifier->allows($subscription, 'market') && $this->notifier->deliver($subscription, 'market', $message)) {
                $sent++;
            }
        }

        return $sent;
    }

    /**
     * Within a few hours after each subscriber's chosen time, once a day.
     */
    private function briefs(): int
    {
        $message = null;
        $sent = 0;
        $lateAfter = (int) config('push.brief_late_after_minutes');

        foreach (PushSubscription::whereNotNull('brief_time')->cursor() as $subscription) {
            if (!$subscription->wants('brief')) {
                continue;
            }

            $local = $subscription->localNow();
            $due = $local->setTimeFromTimeString($subscription->brief_time);

            if ($subscription->last_brief_on?->toDateString() === $local->toDateString()
                || $local->lessThan($due)
                || $due->diffInMinutes($local) > $lateAfter) {
                continue;
            }

            // Marked first, so a failed send isn't retried into the evening.
            $subscription->update(['last_brief_on' => $local->toDateString()]);

            $message ??= $this->briefMessage();

            if ($this->notifier->deliver($subscription, 'brief', $message)) {
                $sent++;
            }
        }

        return $sent;
    }

    private function briefMessage(): array
    {
        $global = MarketData::remember('market_global');
        $snapshot = NewsSentimentSnapshot::latest('id')->first();

        $bigStories = NewsCluster::where('analysis_status', NewsCluster::STATUS_ANALYZED)
            ->where('impact', 'high')
            ->where('trader_relevance', '>=', (int) config('news.min_relevance'))
            ->where('latest_published_at', '>=', CarbonImmutable::now()->subDay())
            ->count();

        return PushMessages::brief(
            is_numeric($global['change_24h'] ?? null) ? (float) $global['change_24h'] : null,
            $snapshot ? [
                'bullish' => (int) $snapshot->bullish,
                'bearish' => (int) $snapshot->bearish,
                'neutral' => (int) $snapshot->neutral,
                'label' => (string) $snapshot->label,
            ] : null,
            $bigStories,
        );
    }

    private function cleanUp(): void
    {
        PushNotification::where('sent_at', '<', now()->subDays((int) config('push.history_days')))->delete();
        PriceAlert::where('triggered_at', '<', now()->subDays((int) config('push.triggered_alert_days')))->delete();
    }
}
