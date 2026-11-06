<?php

namespace Tests\Unit\Insight;

use App\Services\Insight\InsightOutlook;
use App\Services\Insight\InsightSummary;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class InsightOutlookTest extends TestCase
{
    private const ZONES = [['id' => 'R1'], ['id' => 'S1']];

    private function answer(array $changes = []): array
    {
        return array_merge([
            'outlook' => ['bullish' => 58, 'neutral' => 27, 'bearish' => 15],
            'confidence' => 'medium',
            'summary' => 'Price holds above S1 with RSI at 56. Technicals lean bullish.',
            'reasons' => ['Trend is up', 'RSI 56.2', 'News 64% bullish'],
            'watch' => 'A close below S1 would change the view.',
        ], $changes);
    }

    public function test_accepts_a_good_answer_and_takes_the_label_from_the_numbers(): void
    {
        $result = InsightOutlook::validated($this->answer(), self::ZONES, 80_000);

        $this->assertSame('bullish', $result['label']);
        $this->assertSame(['bullish' => 58, 'neutral' => 27, 'bearish' => 15], $result['outlook']);
        $this->assertSame('medium', $result['confidence']);
    }

    public function test_percentages_are_normalized_to_100(): void
    {
        $result = InsightOutlook::validated($this->answer(['outlook' => ['bullish' => 10, 'neutral' => 10, 'bearish' => 60]]), self::ZONES, 80_000);

        $this->assertSame(100, array_sum($result['outlook']));
        $this->assertSame('bearish', $result['label']);
    }

    public function test_a_tie_is_neutral(): void
    {
        $result = InsightOutlook::validated($this->answer(['outlook' => ['bullish' => 40, 'neutral' => 20, 'bearish' => 40]]), self::ZONES, 80_000);

        $this->assertSame('neutral', $result['label']);
    }

    public function test_long_text_is_trimmed_and_extra_reasons_dropped(): void
    {
        $result = InsightOutlook::validated($this->answer([
            'summary' => str_repeat('a', 400),
            'reasons' => [str_repeat('b', 100), 'two', 'three', 'four', 'five'],
            'watch' => str_repeat('c', 200),
        ]), self::ZONES, 80_000);

        $this->assertSame(300, mb_strlen($result['summary']));
        $this->assertSame(80, mb_strlen($result['reasons'][0]));
        $this->assertCount(4, $result['reasons']);
        $this->assertSame(120, mb_strlen($result['watch']));
    }

    public static function badAnswers(): array
    {
        return [
            'empty summary' => [['summary' => '  ']],
            'no watch' => [['watch' => null]],
            'all zero' => [['outlook' => ['bullish' => 0, 'neutral' => 0, 'bearish' => 0]]],
            'bad confidence' => [['confidence' => 'certain']],
            'dollar price' => [['summary' => 'Price holds above $80,000 for now.']],
            'bare price' => [['watch' => 'A break of 81,500 would change the view.']],
            'price in a reason' => [['reasons' => ['Resistance near 80500']]],
            'level that does not exist' => [['watch' => 'A break of R3 would change the view.']],
        ];
    }

    #[DataProvider('badAnswers')]
    public function test_rejects_bad_answers(array $changes): void
    {
        $this->assertNull(InsightOutlook::validated($this->answer($changes), self::ZONES, 80_000));
    }

    public function test_rejects_a_non_array(): void
    {
        $this->assertNull(InsightOutlook::validated('nope', self::ZONES, 80_000));
    }

    public static function priceMentions(): array
    {
        return [
            // [text, coin price, is it a price?]
            'dollar sign' => ['Above $5 for now', 80_000.0, true],
            'peso sign' => ['Above ₱5 for now', 80_000.0, true],
            'the word usd' => ['Trading at 5 USD', 80_000.0, true],
            'grouped number' => ['Holding 79,500 today', 80_000.0, true],
            'plain number' => ['Holding 79500 today', 80_000.0, true],
            'small coin price' => ['Holding 0.31 today', 0.3, true],
            'percentage' => ['Volume is up 18%', 18.0, false],
            'spaced percentage' => ['Volume is up 18 %', 18.0, false],
            'decimal percentage' => ['S1 is 0.31% below', 0.3, false],
            'rsi reading' => ['RSI 56.2 is neutral', 50.0, false],
            'rsi with period' => ['RSI (14) at 56 is neutral', 50.0, false],
            'level id' => ['R1 is close', 1.0, false],
            'indicator name' => ['Below EMA20 and over 24h', 20.0, false],
            'number far from the price' => ['Two of 4 levels', 80_000.0, false],
        ];
    }

    #[DataProvider('priceMentions')]
    public function test_spots_price_mentions(string $text, float $price, bool $expected): void
    {
        $this->assertSame($expected, InsightOutlook::mentionsPrice($text, $price));
    }

    public function test_change_compares_with_the_candle_a_day_ago(): void
    {
        $candles = [
            ['time' => 0, 'close' => 50.0],
            ['time' => 3_600, 'close' => 100.0],
            ['time' => 86_400, 'close' => 200.0],
            ['time' => 90_000, 'close' => 300.0],
        ];

        // The newest candle is at 90,000, so a day earlier is 3,600.
        $this->assertSame(10.0, InsightSummary::change24hPct($candles, 110.0));
    }

    public function test_change_uses_the_oldest_candle_when_there_is_under_a_day(): void
    {
        $candles = [['time' => 100, 'close' => 100.0], ['time' => 200, 'close' => 120.0]];

        $this->assertSame(50.0, InsightSummary::change24hPct($candles, 150.0));
    }
}
