<?php

namespace Tests\Unit\News;

use App\Support\News\TitleSimilarity;
use PHPUnit\Framework\TestCase;

class TitleSimilarityTest extends TestCase
{
    public function test_tokens_are_lowercased_singular_without_stopwords_or_numbers(): void
    {
        $this->assertSame(
            ['approve', 'etf', 'sec', 'solana'],
            TitleSimilarity::tokens('The SEC approves a Solana ETFs at $81,500!')
        );

        $this->assertSame(['moody', 'rating', 'ripple'], TitleSimilarity::tokens('Ripple’s ratings by Moody’s'));
    }

    public function test_same_event_from_two_outlets_clears_threshold(): void
    {
        $a = TitleSimilarity::tokens('SEC Approves First Spot Solana ETF');
        $b = TitleSimilarity::tokens('SEC approves first spot Solana ETFs in landmark decision');

        // Not identical, but well above unrelated headlines.
        $this->assertGreaterThanOrEqual(0.5, TitleSimilarity::jaccard($a, $b));
    }

    public function test_threshold_separates_different_events(): void
    {
        $a = TitleSimilarity::tokens('Bitcoin ETF inflows hit record high');
        $b = TitleSimilarity::tokens('Ethereum developers delay Pectra upgrade');

        $this->assertLessThan(0.6, TitleSimilarity::jaccard($a, $b));
    }

    public function test_jaccard_bounds(): void
    {
        $this->assertSame(1.0, TitleSimilarity::jaccard(['a', 'b'], ['a', 'b']));
        $this->assertSame(0.0, TitleSimilarity::jaccard(['a'], ['b']));
        $this->assertSame(0.0, TitleSimilarity::jaccard([], ['b']));
        $this->assertEqualsWithDelta(1 / 3, TitleSimilarity::jaccard(['a', 'b'], ['b', 'c']), 0.0001);
    }
}
