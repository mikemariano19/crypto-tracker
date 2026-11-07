<?php

namespace App\Http\Controllers;

use App\Services\Insight\ChartData;
use App\Services\Insight\PriceInsight;
use App\Support\StaleCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InsightController extends Controller
{
    public function chart(string $id, Request $request): JsonResponse
    {
        if ($error = $this->inputError($id, $request, ChartData::chartTimeframes())) {
            return $error;
        }

        $timeframe = $this->timeframe($request);

        return StaleCache::respond(
            ChartData::chartKey($id, $timeframe),
            ChartData::chartFreshSeconds($timeframe),
            fn () => ChartData::chart($id, $timeframe),
        );
    }

    /**
     * Whether a fresh analysis exists. Never computes anything or calls the AI.
     */
    public function show(string $id, Request $request, PriceInsight $insight): JsonResponse
    {
        if ($error = $this->inputError($id, $request)) {
            return $error;
        }

        $cached = $this->isAllowed($id) ? $insight->cached($id, $this->timeframe($request)) : null;

        if (!$cached) {
            return response()->json([
                'success' => false,
                'cached' => false,
                'error' => 'No analysis yet.',
            ], 404, ['Cache-Control' => 'no-store']);
        }

        return $this->respond($cached, 'cache');
    }

    /**
     * The "AI Analyze" button: the cached result, or a new analysis.
     */
    public function run(string $id, Request $request, PriceInsight $insight): JsonResponse
    {
        if ($error = $this->inputError($id, $request)) {
            return $error;
        }

        if (!$this->isAllowed($id)) {
            return response()->json([
                'success' => false,
                'error' => 'AI analysis is only available for top coins.',
            ], 403);
        }

        $timeframe = $this->timeframe($request);
        $wasCached = $insight->cached($id, $timeframe) !== null;
        $result = $insight->run($id, $timeframe);

        return $result
            ? $this->respond($result, $wasCached ? 'cache' : 'analysis')
            : StaleCache::unavailable();
    }

    private function respond(array $insight, string $source): JsonResponse
    {
        return StaleCache::jsonResponse($insight, $insight['analyzedAt'], $source, false, $insight['analyzedAt']);
    }

    /**
     * @param  array<string, int>|null  $timeframes  defaults to the ones that can be analyzed
     */
    private function inputError(string $id, Request $request, ?array $timeframes = null): ?JsonResponse
    {
        if (!preg_match('/^[a-zA-Z0-9-]+$/', $id)) {
            return response()->json(['success' => false, 'error' => 'Invalid coin ID.'], 422);
        }

        if (!array_key_exists($this->timeframe($request), $timeframes ?? ChartData::TIMEFRAMES)) {
            return response()->json(['success' => false, 'error' => 'Invalid chart timeframe.'], 422);
        }

        return null;
    }

    private function timeframe(Request $request): string
    {
        return (string) $request->query('tf', '1d');
    }

    private function isAllowed(string $id): bool
    {
        return array_key_exists($id, config('insight.allowed_coins'));
    }
}
