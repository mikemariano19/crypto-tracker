<?php

namespace App\Support\News;

/**
 * "Is this useful to a trader?" as a 0–100 score, from the keyword rules in
 * config/news_keywords.php. No AI involved.
 *
 *   keywords (capped) + coins mentioned (capped) + extra sources (capped)
 *   + credibility − penalties, clamped to 0–100
 */
class RelevanceScorer
{
    /** @var array<string, string> */
    private array $patternCache = [];

    public function __construct(private array $rules) {}

    public static function fromConfig(): self
    {
        return new self(config('news_keywords'));
    }

    /**
     * @return array{score: int, assets: string[], tags: string[]}
     */
    public function score(string $title, ?string $snippet, int $sourceCount, float $credibility): array
    {
        $snippet ??= '';
        $snippetFactor = (float) ($this->rules['snippet_factor'] ?? 0.5);

        $keywordPoints = 0.0;
        $tags = [];

        foreach ($this->rules['groups'] ?? [] as $group) {
            foreach ($group['terms'] as $term => $tag) {
                $factor = match (true) {
                    $this->matches($term, $title) => 1.0,
                    $this->matches($term, $snippet) => $snippetFactor,
                    default => 0.0,
                };

                if ($factor > 0) {
                    $keywordPoints += $group['weight'] * $factor;
                    $tags[$tag] = true;
                }
            }
        }

        $assets = $this->assets("{$title} {$snippet}");
        $assetPoints = $assets === []
            ? 0
            : min(
                $this->rules['asset_cap'],
                $this->rules['asset_weight'] + (count($assets) - 1) * $this->rules['extra_asset_weight']
            );

        $sourcePoints = min(
            $this->rules['source_bonus_cap'],
            max(0, $sourceCount - 1) * $this->rules['per_extra_source']
        );

        $penaltyPoints = 0;

        foreach ($this->rules['penalty_terms'] ?? [] as $term) {
            if ($this->matches($term, $title) || $this->matches($term, $snippet)) {
                $penaltyPoints += $this->rules['penalty'];
            }
        }

        $score = min($this->rules['keyword_cap'], $keywordPoints)
            + $assetPoints
            + $sourcePoints
            + $credibility * $this->rules['credibility_weight']
            - $penaltyPoints;

        return [
            'score' => (int) round(max(0, min(100, $score))),
            'assets' => $assets,
            'tags' => array_slice(array_keys($tags), 0, 4),
        ];
    }

    /**
     * Tickers of the coins a text mentions, in config order.
     *
     * @return string[]
     */
    public function assets(string $text): array
    {
        $found = [];

        foreach ($this->rules['assets'] ?? [] as $ticker => $names) {
            foreach ([$ticker, ...$names] as $term) {
                if ($this->matches($term, $text)) {
                    $found[] = $ticker;
                    break;
                }
            }
        }

        return $found;
    }

    /**
     * Whole-word match allowing simple suffixes (ETF → ETFs, hack → hacked).
     * ALL-CAPS terms are case-sensitive so tickers don't match plain words.
     */
    public function matches(string $term, string $text): bool
    {
        if ($text === '') {
            return false;
        }

        $this->patternCache[$term] ??= sprintf(
            '/(?<![\p{L}\p{N}])%s(?:s|es|ed|ing)?(?![\p{L}\p{N}])/u%s',
            str_replace(' ', '[\s-]+', preg_quote($term, '/')),
            preg_match('/^[A-Z0-9]+$/', $term) ? '' : 'i'
        );

        return preg_match($this->patternCache[$term], $text) === 1;
    }
}
