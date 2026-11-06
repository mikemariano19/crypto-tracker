<?php

namespace App\Services\Insight;

use App\Support\News\NewsSentiment;

/**
 * Checks Claude's outlook before anyone sees it. The schema fixes the shape,
 * not the values, and the core rule is that price levels only ever come from
 * our own calculations, so an answer that writes a price is rejected.
 */
class InsightOutlook
{
    private const SUMMARY_MAX = 300;

    private const REASON_MAX = 80;

    private const MAX_REASONS = 4;

    private const WATCH_MAX = 120;

    /**
     * @param  array<int, array{id: string}>  $zones
     * @return array{outlook: array, label: string, confidence: string, summary: string, reasons: array, watch: string}|null
     */
    public static function validated(mixed $answer, array $zones, float $price): ?array
    {
        if (!is_array($answer)) {
            return null;
        }

        $split = (array) ($answer['outlook'] ?? []);
        $bullish = max(0, (int) ($split['bullish'] ?? 0));
        $neutral = max(0, (int) ($split['neutral'] ?? 0));
        $bearish = max(0, (int) ($split['bearish'] ?? 0));

        $confidence = $answer['confidence'] ?? null;
        $summary = self::text($answer['summary'] ?? null, self::SUMMARY_MAX);
        $watch = self::text($answer['watch'] ?? null, self::WATCH_MAX);

        $reasons = collect((array) ($answer['reasons'] ?? []))
            ->map(fn ($reason) => self::text($reason, self::REASON_MAX))
            ->filter()
            ->take(self::MAX_REASONS)
            ->values()
            ->all();

        if (
            !$summary
            || !$watch
            || $bullish + $neutral + $bearish === 0
            || !in_array($confidence, ['low', 'medium', 'high'], true)
        ) {
            return null;
        }

        $ids = array_column($zones, 'id');

        foreach ([$summary, $watch, ...$reasons] as $text) {
            if (self::mentionsPrice($text, $price) || self::mentionsUnknownLevel($text, $ids)) {
                return null;
            }
        }

        // Label comes from the numbers so the two can't disagree.
        $outlook = NewsSentiment::normalize($bullish, $bearish, $neutral);

        return [
            'outlook' => ['bullish' => $outlook['bullish'], 'neutral' => $outlook['neutral'], 'bearish' => $outlook['bearish']],
            'label' => NewsSentiment::label($outlook),
            'confidence' => $confidence,
            'summary' => $summary,
            'reasons' => $reasons,
            'watch' => $watch,
        ];
    }

    /**
     * A currency sign or word, or a bare number in the same range as the coin's
     * price. Percentages and the RSI reading are allowed, and so is anything
     * attached to letters, like EMA20 or 24h.
     */
    public static function mentionsPrice(string $text, float $price): bool
    {
        if (preg_match('/[$₱€£¥]|\b(usd|dollars?|pesos?)\b/iu', $text)) {
            return true;
        }

        $withoutRsi = preg_replace('/\bRSI\s*(\(\d+\))?\s*(of|at|near|around|is|=|:)?\s*\d+(\.\d+)?/i', '', $text);

        preg_match_all('/(?<![\w.,])\d[\d,]*(?:\.\d+)?(?![\w%]|[.,]\d|\s*%|\s*percent)/i', (string) $withoutRsi, $matches);

        foreach ($matches[0] as $number) {
            $value = (float) str_replace(',', '', $number);

            if ($value >= $price * 0.5 && $value <= $price * 2) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  string[]  $ids
     */
    public static function mentionsUnknownLevel(string $text, array $ids): bool
    {
        preg_match_all('/\b[RS]\d\b/', $text, $matches);

        return array_diff($matches[0], $ids) !== [];
    }

    private static function text(mixed $value, int $maxChars): ?string
    {
        if (!is_string($value)) {
            return null;
        }

        $text = trim(strip_tags($value));

        if ($text === '') {
            return null;
        }

        return mb_strlen($text) > $maxChars ? rtrim(mb_substr($text, 0, $maxChars - 1)) . '…' : $text;
    }
}
