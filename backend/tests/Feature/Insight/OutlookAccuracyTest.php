<?php

namespace Tests\Feature\Insight;

use App\Models\InsightOutlook;
use App\Services\Insight\OutlookAccuracy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class OutlookAccuracyTest extends TestCase
{
    use RefreshDatabase;

    private const AI = ['label' => 'bullish'];

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        Http::preventStrayRequests();
        $this->travelTo('2026-11-06 12:00:00');
    }

    private function fakePrice(float $usd, string $coin = 'bitcoin'): void
    {
        Http::fake(['api.coingecko.com/api/v3/simple/price*' => Http::response([$coin => ['usd' => $usd]])]);
    }

    private function outlook(array $values = []): InsightOutlook
    {
        return InsightOutlook::create(array_merge([
            'coin_id' => 'bitcoin',
            'timeframe' => '1d',
            'label' => 'bullish',
            'price' => 100,
            'analyzed_at' => now()->subDay(),
            'resolve_at' => now(),
        ], $values));
    }

    public function test_recording_stores_the_outlook_with_its_window(): void
    {
        OutlookAccuracy::record('bitcoin', '7d', self::AI, 80_000);

        $outlook = InsightOutlook::sole();

        $this->assertSame('bitcoin', $outlook->coin_id);
        $this->assertSame('bullish', $outlook->label);
        $this->assertSame(80_000.0, $outlook->price);
        $this->assertSame('2026-11-13 12:00:00', $outlook->resolve_at->toDateTimeString());
        $this->assertNull($outlook->matched);
    }

    public static function outcomes(): array
    {
        return [
            'bullish, price up' => ['bullish', 1.0, true],
            'bullish, price flat' => ['bullish', 0.2, false],
            'bullish, price down' => ['bullish', -1.0, false],
            'bearish, price down' => ['bearish', -1.0, true],
            'bearish, price flat' => ['bearish', -0.2, false],
            'bearish, price up' => ['bearish', 1.0, false],
            'neutral, price flat' => ['neutral', 0.3, true],
            'neutral, exactly on the band' => ['neutral', -0.5, true],
            'neutral, price moved' => ['neutral', 0.9, false],
        ];
    }

    #[DataProvider('outcomes')]
    public function test_what_counts_as_a_match(string $label, float $move, bool $expected): void
    {
        $this->assertSame($expected, OutlookAccuracy::matched($label, $move, 0.5));
    }

    public function test_due_outlooks_are_scored_with_the_real_move(): void
    {
        $this->fakePrice(110);
        $outlook = $this->outlook();

        $counts = OutlookAccuracy::resolveDue();

        $outlook->refresh();
        $this->assertSame(1, $counts['resolved']);
        $this->assertSame(10.0, $outlook->move_pct);
        $this->assertTrue($outlook->matched);
        $this->assertNotNull($outlook->resolved_at);
    }

    public function test_outlooks_not_yet_due_are_left_alone(): void
    {
        Http::fake();
        $outlook = $this->outlook(['resolve_at' => now()->addHour()]);

        OutlookAccuracy::resolveDue();

        $this->assertNull($outlook->refresh()->resolved_at);
        Http::assertNothingSent();
    }

    public function test_each_timeframe_uses_its_own_flat_band(): void
    {
        $this->fakePrice(101);
        $day = $this->outlook(['timeframe' => '1d']);
        $week = $this->outlook(['timeframe' => '7d']);

        OutlookAccuracy::resolveDue();

        // 1% is a real move in a day, but flat over a week.
        $this->assertTrue($day->refresh()->matched);
        $this->assertFalse($week->refresh()->matched);
    }

    public function test_a_much_later_check_closes_without_a_score(): void
    {
        Http::fake();
        $outlook = $this->outlook(['resolve_at' => now()->subHours(7)]);

        $counts = OutlookAccuracy::resolveDue();

        $outlook->refresh();
        $this->assertSame(1, $counts['skipped']);
        $this->assertNotNull($outlook->resolved_at);
        $this->assertNull($outlook->matched);
        Http::assertNothingSent();
    }

    public function test_without_a_fresh_price_it_waits_for_the_next_run(): void
    {
        Http::fake(['api.coingecko.com/*' => Http::response([], 500)]);
        $outlook = $this->outlook();

        $counts = OutlookAccuracy::resolveDue();

        $this->assertSame(1, $counts['waiting']);
        $this->assertNull($outlook->refresh()->resolved_at);
    }

    public function test_each_coin_is_only_asked_for_once(): void
    {
        $this->fakePrice(110);
        $this->outlook(['timeframe' => '1d']);
        $this->outlook(['timeframe' => '7d']);

        OutlookAccuracy::resolveDue();

        Http::assertSentCount(1);
        Http::assertSent(fn (Request $request) => $request['ids'] === 'bitcoin');
    }

    public function test_old_records_are_removed(): void
    {
        $this->outlook(['analyzed_at' => now()->subDays(61), 'resolved_at' => now()->subDays(60), 'resolve_at' => now()->subDays(60)]);
        $kept = $this->outlook(['analyzed_at' => now()->subDays(10), 'resolved_at' => now()->subDays(9), 'resolve_at' => now()->subDays(9)]);

        OutlookAccuracy::resolveDue();

        $this->assertSame([$kept->id], InsightOutlook::pluck('id')->all());
    }

    private function scored(int $count, bool $matched, string $timeframe = '1d', array $values = []): void
    {
        for ($i = 0; $i < $count; $i++) {
            $this->outlook(array_merge(['timeframe' => $timeframe, 'resolved_at' => now()->subDay(), 'matched' => $matched], $values));
        }
    }

    public function test_stats_wait_for_a_fair_sample(): void
    {
        config(['insight.accuracy.min_sample' => 5]);
        $this->scored(4, true);

        $this->assertNull(OutlookAccuracy::stats('1d'));
    }

    public function test_stats_give_the_share_that_matched(): void
    {
        config(['insight.accuracy.min_sample' => 5]);
        $this->scored(3, true);
        $this->scored(1, false);
        $this->scored(1, false);

        $this->assertSame(['matchedPct' => 60, 'sample' => 5, 'days' => 30], OutlookAccuracy::stats('1d'));
    }

    public function test_stats_ignore_other_timeframes_old_and_unscored_outlooks(): void
    {
        config(['insight.accuracy.min_sample' => 1]);
        $this->scored(1, true, '1d');
        $this->scored(5, false, '7d');
        $this->scored(5, false, '1d', ['resolved_at' => now()->subDays(31)]);
        $this->outlook(['resolved_at' => now()->subDay(), 'matched' => null]);

        $this->assertSame(['matchedPct' => 100, 'sample' => 1, 'days' => 30], OutlookAccuracy::stats('1d'));
    }

    public function test_the_command_runs_and_reports(): void
    {
        $this->fakePrice(110);
        $this->outlook();

        $this->artisan('insight:resolve')
            ->expectsOutputToContain('Outlooks scored: 1')
            ->assertSuccessful();
    }
}
