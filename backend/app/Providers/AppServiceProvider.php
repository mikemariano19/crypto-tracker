<?php

namespace App\Providers;

use App\Support\News\RelevanceScorer;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(RelevanceScorer::class, fn () => RelevanceScorer::fromConfig());
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Every endpoint is served from cache, so this only stops abuse;
        // a normal dashboard tab makes a handful of requests per minute.
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(120)->by($request->ip());
        });

        // Cache hits count too: they're cheap, but this stops scripted hammering.
        RateLimiter::for('insight', function (Request $request) {
            $tooMany = fn (Request $request, array $headers) => response()->json([
                'success' => false,
                'error' => 'Too many requests. Please try again shortly.',
                'retryAfter' => (int) ($headers['Retry-After'] ?? 60),
            ], 429, $headers);

            return [
                Limit::perMinute(10)->by('minute:' . $request->ip())->response($tooMany),
                Limit::perHour(60)->by('hour:' . $request->ip())->response($tooMany),
            ];
        });
    }
}
