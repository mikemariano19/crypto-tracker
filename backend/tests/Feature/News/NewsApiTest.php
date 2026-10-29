<?php

namespace Tests\Feature\News;

use App\Models\NewsArticle;
use App\Models\NewsCluster;
use App\Support\News\NewsFeed;
use App\Support\News\NewsSentiment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class NewsApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        $this->travelTo('2026-10-29 12:00:00');
        Http::fake(['*' => Http::response([], 500)]);
    }

    public function test_feed_lists_relevant_stories_with_related_sources(): void
    {
        $story = $this->story('SEC approves Solana ETF', 80, hoursAgo: 1, extraSources: 2);
        $this->story('Low relevance story', 10, hoursAgo: 1);

        $response = $this->getJson('/api/news')->assertOk();

        $response->assertJsonCount(1, 'data.items');
        $response->assertJsonPath('data.items.0.clusterId', $story->id);
        $response->assertJsonPath('data.items.0.analyzed', false);
        $response->assertJsonPath('data.items.0.sentiment', null);
        $response->assertJsonCount(2, 'data.items.0.related');
        $response->assertJsonPath('data.nextCursor', null);
    }

    public function test_label_filter_only_returns_analyzed_stories(): void
    {
        $this->story('Bitcoin ETF inflows record', 80, hoursAgo: 1, analyzed: [70, 10, 20]);
        $this->story('Ethereum ETF outflows', 80, hoursAgo: 1, analyzed: [10, 70, 20]);
        $this->story('Unanalyzed ETF news', 80, hoursAgo: 1);

        $this->getJson('/api/news?label=bullish')
            ->assertOk()
            ->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.label', 'bullish')
            ->assertJsonPath('data.items.0.sentiment.bullish', 70);
    }

    public function test_range_asset_and_validation(): void
    {
        $this->story('Bitcoin halving', 80, hoursAgo: 2, assets: ['BTC']);
        $this->story('Solana upgrade', 80, hoursAgo: 30, assets: ['SOL']);

        $this->getJson('/api/news?range=6h')->assertJsonCount(1, 'data.items');
        $this->getJson('/api/news?range=3d&asset=sol')->assertJsonCount(1, 'data.items')
            ->assertJsonPath('data.items.0.assets', ['SOL']);
        $this->getJson('/api/news?label=moon')->assertStatus(422)->assertJsonPath('success', false);
    }

    public function test_cursor_pagination(): void
    {
        foreach (range(1, NewsFeed::PER_PAGE + 5) as $i) {
            $this->story("Story {$i} ETF", 80, hoursAgo: $i % 48);
        }

        $first = $this->getJson('/api/news')->assertJsonCount(NewsFeed::PER_PAGE, 'data.items');
        $cursor = $first->json('data.nextCursor');
        $this->assertNotNull($cursor);

        $this->getJson('/api/news?cursor=' . urlencode($cursor))
            ->assertJsonCount(5, 'data.items')
            ->assertJsonPath('data.nextCursor', null);
    }

    public function test_global_snapshot_and_trend(): void
    {
        $this->getJson('/api/news/sentiment/global')
            ->assertOk()
            ->assertJsonPath('data.sentiment', null);

        $this->story('Bitcoin ETF inflows record', 90, hoursAgo: 1, analyzed: [80, 10, 10], assets: ['BTC']);
        $this->story('Exchange hacked', 90, hoursAgo: 1, analyzed: [10, 80, 10], assets: ['ETH']);
        NewsSentiment::snapshot(null, 'Mixed day.');
        NewsFeed::bumpVersion();

        $response = $this->getJson('/api/news/sentiment/global')->assertOk();
        $this->assertSame(100, array_sum($response->json('data.sentiment')));
        $response->assertJsonPath('data.aiSummary', 'Mixed day.');
        $response->assertJsonCount(2, 'data.byAsset');

        $this->getJson('/api/news/sentiment/trend?days=7')->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_single_story_and_404(): void
    {
        $story = $this->story('SEC approves Solana ETF', 80, hoursAgo: 1);

        $this->getJson("/api/news/{$story->id}")->assertOk()->assertJsonPath('data.headline', 'SEC approves Solana ETF');
        $this->getJson('/api/news/01JBXXXXXXXXXXXXXXXXXXXXXX')->assertNotFound();
        $this->getJson('/api/news/nope')->assertNotFound();
    }

    private function story(
        string $title,
        int $relevance,
        int $hoursAgo,
        int $extraSources = 0,
        ?array $analyzed = null,
        array $assets = [],
    ): NewsCluster {
        $time = now()->subHours($hoursAgo);

        $cluster = NewsCluster::create([
            'trader_relevance' => $relevance,
            'assets' => $assets,
            'tags' => ['ETF'],
            'impact' => 'high',
            'impact_rank' => 3,
            'first_published_at' => $time,
            'latest_published_at' => $time,
            'source_count' => 1 + $extraSources,
        ]);

        foreach (range(0, $extraSources) as $i) {
            $article = NewsArticle::create([
                'cluster_id' => $cluster->id,
                'source' => "source{$i}",
                'source_name' => "Source {$i}",
                'url' => "https://example.com/{$cluster->id}/{$i}",
                'url_hash' => hash('sha256', "{$cluster->id}/{$i}"),
                'title' => $title,
                'title_tokens' => [],
                'credibility' => 1.0,
                'published_at' => $time,
            ]);

            if ($i === 0) {
                $cluster->update(['primary_article_id' => $article->id]);
            }
        }

        if ($analyzed) {
            $split = NewsSentiment::normalize(...$analyzed);
            $cluster->update([
                'analysis_status' => NewsCluster::STATUS_ANALYZED,
                'sentiment_bullish' => $split['bullish'],
                'sentiment_bearish' => $split['bearish'],
                'sentiment_neutral' => $split['neutral'],
                'label' => NewsSentiment::label($split),
                'summary' => 'Summary',
                'take_teaser' => 'Teaser',
                'take_view' => 'View',
            ]);
        }

        return $cluster;
    }
}
