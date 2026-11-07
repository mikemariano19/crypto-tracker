<?php

namespace App\Services\Insight;

use Illuminate\Contracts\Cache\LockTimeoutException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * Runs and caches one price analysis, shared by every visitor. The AI only runs
 * here, on a button click, on a cache miss, and within the daily budget; if it
 * can't run, the computed levels and indicators are still returned.
 */
class PriceInsight
{
    public const AI_OK = 'ok';

    public const AI_UNAVAILABLE = 'unavailable';

    public const AI_BUDGET_PAUSED = 'budget_paused';

    // One retry per the spec: a second bad answer won't be fixed by a third.
    private const AI_ATTEMPTS = 2;

    // Longer than the slowest run, so a second run can't start alongside it.
    private const LOCK_SECONDS = 180;

    // The timeframe whose levels 1D and 7D are checked against.
    private const HIGHER_TIMEFRAME = '30d';

    // Fetching 30D's candles is two CoinGecko calls. With less time than this
    // left, the AI matters more, so 1D goes without the check.
    private const MIN_SECONDS_TO_FETCH_HIGHER = 20;

    // When this run must be done by (microtime), set at the start of run().
    private float $deadline = INF;

    // Set when the outlook was skipped for lack of time rather than failing.
    private bool $outOfTime = false;

    public function __construct(private ClaudeInsightClient $client) {}

    public function cached(string $coinId, string $timeframe): ?array
    {
        return Cache::get(self::key($coinId, $timeframe));
    }

    /**
     * The cached result, or a new analysis. Null means no result could be
     * produced right now: the market data is unavailable, or another request's
     * analysis outlasted the wait.
     */
    public function run(string $coinId, string $timeframe): ?array
    {
        $cached = $this->cached($coinId, $timeframe);

        if ($cached) {
            Log::info('Insight cache hit', ['coin' => $coinId, 'timeframe' => $timeframe]);

            return $cached;
        }

        $this->deadline = microtime(true) + (int) config('insight.deadline_seconds');
        $this->outOfTime = false;

        $lock = Cache::lock("insight:lock:{$coinId}:{$timeframe}", self::LOCK_SECONDS);

        try {
            $lock->block((int) config('insight.lock_wait_seconds'));
        } catch (LockTimeoutException) {
            return $this->cached($coinId, $timeframe);
        }

        try {
            // Whoever held the lock has probably just stored the result.
            return $this->cached($coinId, $timeframe) ?? $this->analyze($coinId, $timeframe);
        } finally {
            $lock->release();
        }
    }

    /**
     * The 30D levels, to check a 1D or 7D analysis against. They're a
     * refinement, so anything missing here just leaves the levels unchecked.
     */
    private function higherLevels(string $coinId, string $timeframe, array $candles, float $price): array
    {
        if ($timeframe === self::HIGHER_TIMEFRAME) {
            return [];
        }

        // 7D already analyzes the same month of candles.
        $month = $timeframe === '7d'
            ? $candles
            : ChartData::monthCandles($coinId, $this->deadline - microtime(true) >= self::MIN_SECONDS_TO_FETCH_HIGHER);

        return $month ? TechnicalAnalysis::levelsFor($month, $price, config('insight.analysis.' . self::HIGHER_TIMEFRAME)) : [];
    }

    private function analyze(string $coinId, string $timeframe): ?array
    {
        $history = ChartData::history($coinId, $timeframe);

        if (!$history) {
            return null;
        }

        $settings = config("insight.analysis.{$timeframe}");
        $symbol = config("insight.allowed_coins.{$coinId}");
        $candles = $history['candles'];

        $analysis = TechnicalAnalysis::analyze($candles, $history['volume'], $settings, $history['price']);
        $analysis['zones'] = TechnicalAnalysis::withHigherTimeframe(
            $analysis['zones'],
            $this->higherLevels($coinId, $timeframe, $candles, $analysis['price']),
            $timeframe,
            self::HIGHER_TIMEFRAME,
        );
        $news = InsightSummary::news($symbol, $settings['visible_seconds']);

        [$ai, $aiStatus] = $this->outlook(
            InsightSummary::forAi($symbol, $timeframe, $analysis, $candles, $news),
            $analysis,
            $coinId,
            $timeframe,
        );

        // A missing outlook gets a short life, so it can fill in soon after.
        $seconds = $aiStatus === self::AI_OK
            ? (int) config("insight.cache_seconds.{$timeframe}")
            : (int) config('insight.no_outlook_cache_seconds');

        if ($ai) {
            OutlookAccuracy::record($coinId, $timeframe, $ai, $analysis['price']);
        }

        // Not cached when time ran out: the market data is cached by now, so a
        // second click can run the AI straight away. Expiring now shows the
        // visitor the "Refresh analysis" link.
        if ($this->outOfTime) {
            $seconds = 0;
        }

        $insight = [
            'coinId' => $coinId,
            'timeframe' => $timeframe,
            ...$analysis,
            'newsPins' => $news['pins'],
            'ai' => $ai,
            'aiStatus' => $aiStatus,
            'accuracy' => OutlookAccuracy::stats($timeframe),
            'analyzedAt' => now()->toIso8601ZuluString(),
            'expiresAt' => now()->addSeconds($seconds)->toIso8601ZuluString(),
        ];

        if ($seconds > 0) {
            Cache::put(self::key($coinId, $timeframe), $insight, $seconds);
        }

        return $insight;
    }

    /**
     * @return array{0: ?array, 1: string} the checked outlook and its status
     */
    private function outlook(array $summary, array $analysis, string $coinId, string $timeframe): array
    {
        if (!$this->client->isConfigured()) {
            return [null, self::AI_UNAVAILABLE];
        }

        for ($attempt = 1; $attempt <= self::AI_ATTEMPTS; $attempt++) {
            if (!InsightBudget::allowsAnotherCall()) {
                Log::warning('Insight AI daily token budget reached', ['coin' => $coinId, 'timeframe' => $timeframe]);

                return [null, self::AI_BUDGET_PAUSED];
            }

            $started = microtime(true);
            $timeLeft = $this->deadline - $started;

            if ($timeLeft < (int) config('insight.min_ai_seconds')) {
                Log::warning('Insight AI skipped, not enough time left', [
                    'coin' => $coinId,
                    'timeframe' => $timeframe,
                    'attempt' => $attempt,
                    'seconds_left' => round($timeLeft, 1),
                ]);
                $this->outOfTime = true;

                return [null, self::AI_UNAVAILABLE];
            }

            try {
                $result = $this->client->outlook($summary, $timeLeft);
            } catch (\Throwable $e) {
                // The SDK has already retried what is worth retrying.
                Log::warning('Insight AI call failed', ['coin' => $coinId, 'timeframe' => $timeframe, 'message' => $e->getMessage()]);

                // Cut off by the deadline rather than a real failure.
                $this->outOfTime = microtime(true) >= $this->deadline - 1;

                return [null, self::AI_UNAVAILABLE];
            }

            InsightBudget::record($result['input_tokens'] + $result['output_tokens']);

            $ai = $result['status'] === ClaudeInsightClient::STATUS_OK
                ? InsightOutlook::validated($result['data'], $analysis['zones'], $analysis['price'])
                : null;

            Log::info('Insight AI call', [
                'coin' => $coinId,
                'timeframe' => $timeframe,
                'attempt' => $attempt,
                'input_tokens' => $result['input_tokens'],
                'output_tokens' => $result['output_tokens'],
                'duration_ms' => (int) ((microtime(true) - $started) * 1000),
                'usable' => $ai !== null,
                'reason' => $result['reason'],
            ]);

            if ($ai) {
                return [$ai, self::AI_OK];
            }
        }

        return [null, self::AI_UNAVAILABLE];
    }

    private static function key(string $coinId, string $timeframe): string
    {
        return "insight:{$coinId}:{$timeframe}";
    }
}
