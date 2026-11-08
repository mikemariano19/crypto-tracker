<?php

namespace App\Support\Push;

use App\Models\PushSubscription;
use App\Services\Insight\ChartData;
use App\Services\Insight\TechnicalAnalysis;
use App\Support\MarketData;
use App\Support\StaleCache;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Alerts about a subscriber's own coins (favorites and wallet): a big move in
 * 4 hours, or a break through a well-tested support or resistance level.
 * Each event is found once for everyone, then sent to whoever watches that
 * coin, batched into one message per subscriber.
 */
class CoinMoves
{
    public function __construct(private Notifier $notifier) {}

    /**
     * @param  Collection<int, PushSubscription>  $watchers  subscribers with this category on and coins to watch
     * @param  array<string, float>  $prices  fresh USD prices
     * @param  array<string, float>  $changes  % change over about 4 hours
     * @param  array<string, float>  $previous  USD price on the previous run
     * @return int notifications sent
     */
    public function run(Collection $watchers, array $prices, array $changes, array $previous): int
    {
        if ($watchers->isEmpty()) {
            return 0;
        }

        $watched = $watchers->pluck('watch_coins')->flatten()->unique()->all();

        // coin => events, found once and shared by every watcher of the coin.
        $events = [];

        foreach ($this->bigMoves($watched, $changes) as $coin => $pct) {
            $events[$coin][] = ['kind' => 'move', 'pct' => $pct];
        }

        foreach ($this->levelBreaks($watched, $prices, $previous) as $coin => $break) {
            $events[$coin][] = ['kind' => 'level', ...$break];
        }

        if ($events === []) {
            return 0;
        }

        $symbols = $this->symbols(array_keys($events));
        $perUsd = MarketData::perUsd();
        $sent = 0;

        foreach ($watchers as $subscription) {
            $mine = array_intersect_key($events, array_flip($subscription->watch_coins));

            if ($mine === [] || !$this->notifier->allows($subscription, 'moves')) {
                continue;
            }

            $rate = $perUsd[$subscription->currency] ?? null;
            [$currency, $rate] = $rate ? [$subscription->currency, $rate] : ['usd', 1.0];
            $hits = [];

            foreach ($mine as $coin => $coinEvents) {
                if ($this->notifier->recentlyAlerted($subscription, $coin)) {
                    continue;
                }

                foreach ($coinEvents as $event) {
                    $hits[] = ['coin' => $coin, 'symbol' => $symbols[$coin], 'price' => $prices[$coin] * $rate, 'currency' => $currency, ...$event];
                }
            }

            if ($hits === []) {
                continue;
            }

            $message = PushMessages::coinMoves($hits, $rate);
            $coinIds = array_values(array_unique(array_column($hits, 'coin')));

            if ($this->notifier->deliver($subscription, 'moves', $message, $coinIds)) {
                $sent++;
            }
        }

        return $sent;
    }

    /**
     * Watched coins that moved past the threshold in 4 hours, once per coin
     * and direction per cooldown, however long the move lasts.
     *
     * @return array<string, float>
     */
    private function bigMoves(array $watched, array $changes): array
    {
        $settings = config('push.moves');
        $moves = [];

        foreach ($watched as $coin) {
            $pct = $changes[$coin] ?? null;

            if ($pct === null || abs($pct) < $settings['pct_4h']) {
                continue;
            }

            $key = "push:move:{$coin}:" . ($pct < 0 ? 'down' : 'up');

            if (Cache::add($key, true, now()->addHours($settings['cooldown_hours']))) {
                $moves[$coin] = $pct;
            }
        }

        return $moves;
    }

    /**
     * Watched coins whose price crossed a moderate or strong 7D level since
     * the previous run. Levels are found the way the 7D analysis finds them,
     * relative to the price before, so "resistance" means it was overhead.
     * Only a close past the far edge counts: price wandering inside a zone is
     * a test, not a break.
     *
     * @return array<string, array{direction: string, from: float, to: float}>
     */
    private function levelBreaks(array $watched, array $prices, array $previous): array
    {
        $settings = config('push.levels');
        $analysis = config('insight.analysis.7d');
        $fetchesLeft = (int) $settings['max_fetches_per_run'];
        $breaks = [];

        foreach ($watched as $coin) {
            $before = $previous[$coin] ?? null;
            $now = $prices[$coin] ?? null;

            if ($before === null || $now === null || $before === $now) {
                continue;
            }

            $candles = $this->monthCandles($coin, $fetchesLeft);

            if (!$candles) {
                continue;
            }

            $crossed = null;

            foreach (TechnicalAnalysis::levelsFor($candles, $before, $analysis) as $zone) {
                if (!in_array($zone['strength'], $settings['strengths'], true)) {
                    continue;
                }

                // The furthest level crossed is the one worth naming.
                if ($zone['type'] === 'resistance' && $before <= $zone['to'] && $now > $zone['to']
                    && ($crossed === null || $zone['to'] > $crossed['to'])) {
                    $crossed = ['direction' => 'up', 'from' => $zone['from'], 'to' => $zone['to']];
                } elseif ($zone['type'] === 'support' && $before >= $zone['from'] && $now < $zone['from']
                    && ($crossed === null || $zone['from'] < $crossed['from'])) {
                    $crossed = ['direction' => 'down', 'from' => $zone['from'], 'to' => $zone['to']];
                }
            }

            if ($crossed && Cache::add("push:level:{$coin}:{$crossed['direction']}", true, now()->addHours($settings['cooldown_hours']))) {
                $breaks[$coin] = $crossed;
            }
        }

        return $breaks;
    }

    /**
     * The month of 4-hour candles the 7D levels come from. Coin pages keep a
     * copy cached for popular coins; others are fetched a few per run so a
     * long watch list can't use up the site's CoinGecko budget.
     */
    private function monthCandles(string $coin, int &$fetchesLeft): ?array
    {
        $candles = ChartData::monthCandles($coin, false);

        if ($candles !== null || $fetchesLeft <= 0) {
            return $candles;
        }

        $fetchesLeft--;

        try {
            return ChartData::monthCandles($coin, true);
        } catch (\Throwable $e) {
            // CoinGecko busy or down: try again on a later run.
            Log::info('Push level check skipped a coin', ['coin' => $coin, 'error' => $e->getMessage()]);

            return null;
        }
    }

    /**
     * Ticker symbols from what's already cached, never a new CoinGecko call.
     *
     * @return array<string, string>
     */
    private function symbols(array $coins): array
    {
        $known = [];

        foreach (['coins', 'search_index'] as $key) {
            foreach (StaleCache::peek($key)['data'] ?? [] as $coin) {
                if (isset($coin['id'], $coin['symbol'])) {
                    $known[$coin['id']] ??= strtoupper($coin['symbol']);
                }
            }
        }

        return array_combine($coins, array_map(
            fn (string $coin) => $known[$coin] ?? ucwords(str_replace('-', ' ', $coin)),
            $coins,
        ));
    }
}
