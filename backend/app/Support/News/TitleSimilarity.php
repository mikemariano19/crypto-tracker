<?php

namespace App\Support\News;

/**
 * Free, token-based headline similarity for clustering (no embeddings).
 */
class TitleSimilarity
{
    private const STOPWORDS = [
        'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have', 'he', 'her', 'his',
        'in', 'is', 'it', 'its', 'of', 'on', 'or', 'over', 'says', 'that', 'the', 'their', 'this', 'to',
        'up', 'was', 'were', 'what', 'will', 'with', 'after', 'amid', 'new', 'into', 'than', 'why', 'how',
        'could', 'may', 'now', 'just', 'here', 'report', 'reportedly', 'news', 'today', 'week', 'more',
    ];

    /**
     * Lowercased, singular words without punctuation, numbers or stopwords,
     * deduped and sorted. Numbers are dropped because outlets quote prices
     * differently ("$81,500" vs "$81K") for the same event.
     *
     * @return string[]
     */
    public static function tokens(string $title): array
    {
        $words = preg_split('/[^\p{L}\p{N}]+/u', mb_strtolower($title), -1, PREG_SPLIT_NO_EMPTY) ?: [];

        $words = array_filter(
            $words,
            fn (string $word) => mb_strlen($word) > 1
                && !preg_match('/\p{N}/u', $word)
                && !in_array($word, self::STOPWORDS, true)
        );

        $words = array_values(array_unique(array_map(self::singular(...), $words)));
        sort($words);

        return $words;
    }

    /**
     * Crude plural stripping (ratings → rating, rallies → rally), enough to
     * line up headline wording without a stemming library.
     */
    private static function singular(string $word): string
    {
        if (mb_strlen($word) <= 3 || str_ends_with($word, 'ss') || str_ends_with($word, 'us')) {
            return $word;
        }

        if (str_ends_with($word, 'ies')) {
            return mb_substr($word, 0, -3) . 'y';
        }

        return str_ends_with($word, 's') ? mb_substr($word, 0, -1) : $word;
    }

    /**
     * |A ∩ B| / |A ∪ B|, from 0 (nothing shared) to 1 (same words).
     *
     * @param  string[]  $a
     * @param  string[]  $b
     */
    public static function jaccard(array $a, array $b): float
    {
        if ($a === [] || $b === []) {
            return 0.0;
        }

        $intersection = count(array_intersect($a, $b));
        $union = count(array_unique([...$a, ...$b]));

        return $intersection / $union;
    }
}
