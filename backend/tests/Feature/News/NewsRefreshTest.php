<?php

namespace Tests\Feature\News;

use App\Jobs\FetchNews;
use App\Models\NewsArticle;
use App\Models\NewsCluster;
use App\Support\News\NewsPipeline;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class NewsRefreshTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo('2026-10-29 12:00:00');
        Queue::fake();
    }

    public function test_empty_feed_starts_one_fetch_and_reports_it(): void
    {
        $this->getJson('/api/news')->assertOk()->assertJsonPath('data.fetching', true);
        $this->getJson('/api/news')->assertOk()->assertJsonPath('data.fetching', true);

        Queue::assertPushed(FetchNews::class, 1);
    }

    public function test_empty_response_is_not_cached_by_the_browser(): void
    {
        $this->assertStringContainsString('no-store', $this->getJson('/api/news')->headers->get('Cache-Control'));
    }

    public function test_feed_with_stories_starts_no_fetch_and_stays_cacheable(): void
    {
        $this->story('SEC approves Solana ETF', hoursAgo: 1);

        $response = $this->getJson('/api/news')->assertOk()->assertJsonPath('data.fetching', false);

        $this->assertStringContainsString('max-age=60', $response->headers->get('Cache-Control'));
        Queue::assertNothingPushed();
    }

    public function test_stories_too_old_for_the_feed_count_as_empty(): void
    {
        $this->story('Old news', hoursAgo: 100);

        $this->getJson('/api/news')->assertJsonPath('data.fetching', true);

        Queue::assertPushed(FetchNews::class, 1);
    }

    public function test_a_filter_with_no_matches_does_not_start_a_fetch(): void
    {
        $this->story('SEC approves Solana ETF', hoursAgo: 1);

        $this->getJson('/api/news?asset=DOGE')
            ->assertJsonCount(0, 'data.items')
            ->assertJsonPath('data.fetching', false);

        Queue::assertNothingPushed();
    }

    public function test_finished_job_clears_fetching_but_the_cooldown_prevents_a_repeat(): void
    {
        $this->getJson('/api/news')->assertJsonPath('data.fetching', true);

        (new FetchNews)->handle($this->mock(NewsPipeline::class, fn ($mock) => $mock->shouldReceive('run')->once()));

        $this->getJson('/api/news')->assertJsonPath('data.fetching', false);

        Queue::assertPushed(FetchNews::class, 1);
    }

    public function test_failed_job_still_clears_fetching(): void
    {
        $this->getJson('/api/news')->assertJsonPath('data.fetching', true);

        $pipeline = $this->mock(NewsPipeline::class, fn ($mock) => $mock->shouldReceive('run')->andThrow(new \RuntimeException('boom')));

        try {
            (new FetchNews)->handle($pipeline);
        } catch (\RuntimeException) {
            // The queue records the failure; only the flag matters here.
        }

        $this->getJson('/api/news')->assertJsonPath('data.fetching', false);
    }

    public function test_a_job_still_queued_after_the_cooldown_is_not_duplicated(): void
    {
        $this->getJson('/api/news');
        $this->travel(11)->minutes();
        $this->getJson('/api/news')->assertJsonPath('data.fetching', true);

        Queue::assertPushed(FetchNews::class, 1);
    }

    public function test_fetch_can_start_again_after_the_cooldown_once_the_job_is_done(): void
    {
        $this->getJson('/api/news');
        // The queue worker releases this lock when a job finishes.
        Cache::lock('laravel_unique_job:' . FetchNews::class . ':')->forceRelease();
        $this->travel(11)->minutes();
        $this->getJson('/api/news')->assertJsonPath('data.fetching', true);

        Queue::assertPushed(FetchNews::class, 2);
    }

    private function story(string $title, int $hoursAgo): NewsCluster
    {
        $publishedAt = now()->subHours($hoursAgo);

        $cluster = NewsCluster::create([
            'assets' => ['SOL'],
            'tags' => [],
            'trader_relevance' => 80,
            'first_published_at' => $publishedAt,
            'latest_published_at' => $publishedAt,
        ]);

        $article = NewsArticle::create([
            'cluster_id' => $cluster->id,
            'source' => 'coindesk',
            'source_name' => 'CoinDesk',
            'url' => 'https://coindesk.com/' . md5($title),
            'url_hash' => hash('sha256', $title),
            'title' => $title,
            'title_tokens' => [],
            'credibility' => 1.0,
            'published_at' => $publishedAt,
        ]);

        $cluster->update(['primary_article_id' => $article->id]);

        return $cluster;
    }
}
