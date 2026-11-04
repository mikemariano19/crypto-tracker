<?php

use App\Jobs\FetchNews;
use App\Models\NewsBatch;
use App\Support\MarketData;
use App\Support\News\NewsAnalyzer;
use App\Support\News\NewsDemo;
use App\Support\News\NewsFeed;
use App\Support\News\NewsPipeline;
use App\Support\News\NewsSchedule;
use App\Support\News\NewsSentiment;
use App\Support\StaleCache;
use App\Support\WalletProviders;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('market:warm', function () {
    foreach (MarketData::endpoints() as $key => [$freshSeconds, $fetch]) {
        $this->line(str_pad($key, 18) . StaleCache::warm($key, $freshSeconds, $fetch));
    }
})->purpose('Refresh cached CoinGecko data before it expires');

Schedule::command('market:warm')->everyMinute()->withoutOverlapping();

Artisan::command('news:fetch {--sync : Run in this process instead of queueing}', function () {
    if (!$this->option('sync')) {
        FetchNews::dispatch();
        $this->info('News fetch queued.');

        return;
    }

    $batch = app(NewsPipeline::class)->run();

    $this->table(['Metric', 'Value'], collect($batch->only([
        'id', 'status', 'articles_fetched', 'articles_new', 'clusters_created',
        'clusters_kept', 'clusters_selected', 'clusters_analyzed', 'ai_requests',
        'ai_input_tokens', 'ai_output_tokens', 'duration_ms',
    ]))->map(fn ($value, $key) => [$key, $value])->values()->all());

    foreach ($batch->errors ?? [] as $error) {
        $this->warn(($error['source'] ?? $error['stage'] ?? '?') . ': ' . $error['message']);
    }
})->purpose('Fetch, cluster, score and analyze crypto news (queued unless --sync)');

Artisan::command('news:analyze', function (NewsAnalyzer $analyzer) {
    if (!$analyzer->isEnabled()) {
        $this->error('Set AI_PROVIDER_API_KEY in .env first.');

        return 1;
    }

    // Its own status, so this run isn't mistaken for a news fetch. Its tokens
    // still count toward the daily budget.
    $batch = NewsBatch::create(['status' => 'analysis', 'started_at' => now()]);
    $summary = $analyzer->analyzeRecent($batch);
    $batch->update(['finished_at' => now()]);

    NewsSentiment::snapshot($batch, $summary);
    NewsFeed::bumpVersion();

    $this->table(['Metric', 'Value'], collect($batch->only([
        'clusters_analyzed', 'ai_requests', 'ai_input_tokens', 'ai_output_tokens',
    ]))->map(fn ($value, $key) => [$key, $value])->values()->all());

    foreach ($batch->errors ?? [] as $error) {
        $this->warn($error['message']);
    }

    if ($summary) {
        $this->newLine();
        $this->line($summary);
    }

    return 0;
})->purpose('Run AI analysis now on recent stories that have none');

Artisan::command('news:demo {--clear : Remove all demo analysis}', function () {
    if (!app()->environment('local')) {
        $this->error('news:demo only runs in the local environment.');

        return 1;
    }

    if ($this->option('clear')) {
        $this->info('Cleared demo analysis from ' . NewsDemo::clear() . ' stories.');

        return 0;
    }

    $this->info('Added [Demo] analysis to ' . NewsDemo::seed() . ' stories. Remove it with news:demo --clear.');
})->purpose('Fill stories with labelled sample sentiment to preview the UI (local only)');

Schedule::job(new FetchNews)->cron(NewsSchedule::cron())->withoutOverlapping();

Artisan::command('wallets:icons', function () {
    $result = WalletProviders::warmIcons();
    $this->info("Wallet provider icons: {$result['found']} found, {$result['missing']} missing, {$result['skipped']} already cached.");
})->purpose('Download site icons for the curated wallet providers');

Schedule::command('wallets:icons')->daily()->withoutOverlapping();
