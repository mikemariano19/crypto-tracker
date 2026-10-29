<?php

namespace Tests\Feature\News;

use App\Models\NewsArticle;
use App\Models\NewsCluster;
use App\Support\News\NewsPipeline;
use App\Support\News\NewsSchedule;
use App\Support\News\RawArticle;
use App\Support\News\Sources\NewsSource;
use Carbon\CarbonImmutable;
use DateTimeInterface;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class NewsPipelineTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        CarbonImmutable::setTestNow('2026-10-29 12:00:00');
        $this->travelTo('2026-10-29 12:00:00');

        // Icon lookups and market data must never hit the network in tests.
        Http::preventStrayRequests();
        Http::fake(['*' => Http::response('', 404)]);
    }

    public function test_clusters_duplicate_coverage_into_one_story(): void
    {
        $batch = $this->pipeline()->run([
            $this->source('coindesk', 1.0, [
                ['SEC approves first spot Solana ETF', 'https://coindesk.com/sol-etf', 2],
            ]),
            $this->source('decrypt', 0.85, [
                ['SEC approves first spot Solana ETF in landmark move', 'https://decrypt.co/sol-etf', 1],
                ['Ethereum developers schedule mainnet upgrade', 'https://decrypt.co/eth-upgrade', 3],
            ]),
        ]);

        $this->assertSame('published', $batch->status);
        $this->assertSame(3, $batch->articles_new);
        $this->assertSame(2, $batch->clusters_created);

        $solana = NewsCluster::where('source_count', 2)->firstOrFail();
        // CoinDesk is more credible, so it's the primary despite being later.
        $this->assertSame('coindesk', $solana->primaryArticle->source);
        $this->assertSame(['SOL'], $solana->assets);
    }

    public function test_dedupes_by_normalized_url_across_runs_and_feeds(): void
    {
        $articles = [
            ['Bitcoin ETF inflows hit record', 'https://coindesk.com/a?utm_source=rss', 1],
            ['Bitcoin ETF inflows hit record', 'https://www.coindesk.com/a/', 1],
        ];

        $first = $this->pipeline()->run([$this->source('coindesk', 1.0, $articles)]);
        $second = $this->pipeline()->run([$this->source('coindesk', 1.0, $articles)]);

        $this->assertSame(1, $first->articles_new);
        $this->assertSame(0, $second->articles_new);
        $this->assertSame(1, NewsArticle::count());
    }

    public function test_selects_only_top_n_relevant_new_clusters_for_ai(): void
    {
        config(['news.max_analyzed_per_run' => 2, 'news.min_relevance' => 40]);

        $this->pipeline()->run([
            $this->source('coindesk', 1.0, [
                ['SEC sues exchange over Solana ETF listing', 'https://coindesk.com/1', 1],
                ['Bitcoin exchange hacked, $40M drained', 'https://coindesk.com/2', 2],
                ['Fed signals rate cut as CPI cools', 'https://coindesk.com/3', 3],
                ['What is a blockchain? A beginner guide to crypto', 'https://coindesk.com/4', 4],
            ]),
        ]);

        $this->assertSame(2, NewsCluster::where('analysis_status', NewsCluster::STATUS_PENDING)->count());
        $this->assertSame(0, NewsCluster::where('trader_relevance', '<', 40)
            ->where('analysis_status', NewsCluster::STATUS_PENDING)->count());
    }

    public function test_one_failing_source_does_not_fail_the_batch(): void
    {
        $broken = new class implements NewsSource {
            public function key(): string { return 'broken'; }
            public function fetch(DateTimeInterface $since): array { throw new \RuntimeException('feed down'); }
        };

        $batch = $this->pipeline()->run([
            $broken,
            $this->source('coindesk', 1.0, [['Bitcoin ETF inflows hit record', 'https://coindesk.com/a', 1]]),
        ]);

        $this->assertSame('published', $batch->status);
        $this->assertSame(1, $batch->articles_new);
        $this->assertSame('broken', $batch->errors[0]['source']);
        $this->assertSame('2026-10-29 18:00:00', $batch->next_update_at->toDateTimeString());
    }

    public function test_pick_top_orders_by_relevance_then_recency(): void
    {
        $make = fn (int $relevance, string $time) => new NewsCluster([
            'trader_relevance' => $relevance,
            'latest_published_at' => $time,
        ]);

        $picked = NewsPipeline::pickTop(new Collection([
            $make(50, '2026-10-29 10:00'),
            $make(90, '2026-10-29 08:00'),
            $make(50, '2026-10-29 11:00'),
            $make(30, '2026-10-29 11:30'),
        ]), 40, 2);

        $this->assertSame([90, 50], $picked->pluck('trader_relevance')->all());
        $this->assertSame('2026-10-29 11:00:00', $picked[1]->latest_published_at->toDateTimeString());
    }

    public function test_schedule_interval_is_clamped(): void
    {
        config(['news.fetch_interval_hours' => 1]);
        $this->assertSame('0 */2 * * *', NewsSchedule::cron());

        config(['news.fetch_interval_hours' => 48]);
        $this->assertSame('0 */12 * * *', NewsSchedule::cron());
    }

    private function pipeline(): NewsPipeline
    {
        return app(NewsPipeline::class);
    }

    /**
     * @param  array<int, array{0: string, 1: string, 2: int}>  $items  [title, url, hours ago]
     */
    private function source(string $key, float $credibility, array $items): NewsSource
    {
        $articles = array_map(fn (array $item) => new RawArticle(
            source: $key,
            sourceName: ucfirst($key),
            url: \App\Support\News\NewsText::normalizeUrl($item[1]),
            title: $item[0],
            snippet: null,
            publishedAt: CarbonImmutable::now()->subHours($item[2]),
            credibility: $credibility,
        ), $items);

        return new class($key, $articles) implements NewsSource {
            public function __construct(private string $key, private array $articles) {}
            public function key(): string { return $this->key; }
            public function fetch(DateTimeInterface $since): array { return $this->articles; }
        };
    }
}
