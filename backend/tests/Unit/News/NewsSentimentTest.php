<?php

namespace Tests\Unit\News;

use App\Support\News\NewsSentiment;
use PHPUnit\Framework\TestCase;

class NewsSentimentTest extends TestCase
{
    public function test_normalized_split_always_sums_to_100(): void
    {
        foreach ([[33.3, 33.3, 33.3], [1, 1, 1], [72, 10, 18], [0.2, 0.5, 0.3], [70, 70, 70], [99.5, 0.25, 0.25]] as [$bull, $bear, $neutral]) {
            $split = NewsSentiment::normalize($bull, $bear, $neutral);

            $this->assertSame(100, array_sum($split), json_encode([$bull, $bear, $neutral]));
        }

        $this->assertSame(['bullish' => 72, 'bearish' => 10, 'neutral' => 18], NewsSentiment::normalize(72, 10, 18));
        $this->assertSame(['bullish' => 72, 'bearish' => 10, 'neutral' => 18], NewsSentiment::normalize(0.72, 0.10, 0.18));
    }

    public function test_empty_or_negative_split_becomes_neutral(): void
    {
        $this->assertSame(['bullish' => 0, 'bearish' => 0, 'neutral' => 100], NewsSentiment::normalize(0, 0, 0));
        $this->assertSame(['bullish' => 0, 'bearish' => 0, 'neutral' => 100], NewsSentiment::normalize(-5, -1, 0));
    }

    public function test_label_is_highest_and_ties_resolve_to_neutral(): void
    {
        $this->assertSame('bullish', NewsSentiment::label(['bullish' => 60, 'bearish' => 10, 'neutral' => 30]));
        $this->assertSame('bearish', NewsSentiment::label(['bullish' => 10, 'bearish' => 60, 'neutral' => 30]));
        $this->assertSame('neutral', NewsSentiment::label(['bullish' => 45, 'bearish' => 45, 'neutral' => 10]));
        $this->assertSame('neutral', NewsSentiment::label(['bullish' => 40, 'bearish' => 20, 'neutral' => 40]));
    }

    public function test_weight_combines_impact_recency_and_credibility(): void
    {
        $this->assertEqualsWithDelta(3.0, NewsSentiment::weight('high', 0, 1.0, 12), 0.0001);
        // One half-life old: half the weight.
        $this->assertEqualsWithDelta(1.0, NewsSentiment::weight('medium', 12, 1.0, 12), 0.0001);
        $this->assertEqualsWithDelta(0.25, NewsSentiment::weight('low', 24, 1.0, 12), 0.0001);
        // Credibility is clamped to 0.5–1.0.
        $this->assertEqualsWithDelta(0.5, NewsSentiment::weight('low', 0, 0.1, 12), 0.0001);
    }
}
