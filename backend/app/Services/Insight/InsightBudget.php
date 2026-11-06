<?php

namespace App\Services\Insight;

use App\Models\NewsBatch;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;

/**
 * Daily AI token limit for insights. By default they share the news budget, as
 * one combined counter. Setting INSIGHT_DAILY_AI_TOKEN_BUDGET gives them their
 * own, and then neither feature can use up the other's.
 */
class InsightBudget
{
    private const KEEP_FOR_HOURS = 48;

    /**
     * Reserves a full response, so the last request can't overshoot by much.
     */
    public static function allowsAnotherCall(): bool
    {
        $reserve = (int) config('insight.ai.max_output_tokens');
        $own = config('insight.daily_ai_token_budget');

        if ($own !== null) {
            return self::usedToday() + $reserve <= (int) $own;
        }

        return self::usedToday() + self::newsUsedToday() + $reserve <= (int) config('news.daily_ai_token_budget');
    }

    public static function record(int $tokens): void
    {
        $key = self::key();

        // add() first: increment() on a missing key wouldn't set an expiry.
        Cache::add($key, 0, now()->addHours(self::KEEP_FOR_HOURS));
        Cache::increment($key, $tokens);
    }

    public static function usedToday(): int
    {
        return (int) Cache::get(self::key(), 0);
    }

    /**
     * What the news pipeline must count against its own budget: nothing when
     * insights have a budget of their own.
     */
    public static function sharedWithNews(): int
    {
        return config('insight.daily_ai_token_budget') === null ? self::usedToday() : 0;
    }

    private static function newsUsedToday(): int
    {
        return (int) NewsBatch::where('started_at', '>=', CarbonImmutable::now()->startOfDay())
            ->selectRaw('COALESCE(SUM(ai_input_tokens + ai_output_tokens), 0) as total')
            ->value('total');
    }

    private static function key(): string
    {
        return 'insight:ai_tokens:' . now()->toDateString();
    }
}
