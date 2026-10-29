<?php

namespace App\Jobs;

use App\Support\News\NewsPipeline;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\Middleware\WithoutOverlapping;
use Illuminate\Queue\SerializesModels;

/**
 * One run of the news pipeline. Never stacks: a second dispatch while one is
 * queued or running is dropped.
 */
class FetchNews implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 600;

    // AI retries are handled inside the run; re-running the whole job would
    // re-spend tokens.
    public int $tries = 1;

    public int $uniqueFor = 3600;

    public function middleware(): array
    {
        return [(new WithoutOverlapping('news-fetch'))->dontRelease()->expireAfter(900)];
    }

    public function handle(NewsPipeline $pipeline): void
    {
        $pipeline->run();
    }
}
