<?php

namespace App\Http\Controllers;

use App\Support\News\NewsFeed;
use App\Support\News\NewsRefresh;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class NewsController extends Controller
{
    public function index(Request $request)
    {
        $validator = Validator::make($request->query(), [
            'label' => ['nullable', Rule::in(['bullish', 'bearish', 'neutral'])],
            'asset' => ['nullable', 'regex:/^[A-Za-z0-9]{2,10}$/'],
            'impact' => ['nullable', Rule::in(['low', 'medium', 'high'])],
            'range' => ['nullable', Rule::in(array_keys(NewsFeed::RANGES))],
            'sort' => ['nullable', Rule::in(['latest', 'impact'])],
            'cursor' => ['nullable', 'string', 'max:500'],
        ]);

        if ($validator->fails()) {
            return $this->invalid($validator->errors()->first());
        }

        $filters = $validator->validated();
        $filters['asset'] = isset($filters['asset']) ? strtoupper($filters['asset']) : null;

        $page = NewsFeed::cached('stories', $filters, fn () => NewsFeed::stories($filters));

        // Outside the cache: this changes while the cached page stays the same.
        $page['fetching'] = $page['items'] === [] && NewsRefresh::startIfEmpty();

        return $this->respond($page, cacheable: $page['items'] !== []);
    }

    public function show(string $clusterId)
    {
        if (!preg_match('/^[0-9A-Za-z]{26}$/', $clusterId)) {
            return $this->notFound();
        }

        $story = NewsFeed::cached('story', [$clusterId], fn () => NewsFeed::story($clusterId) ?? []);

        return $story ? $this->respond($story) : $this->notFound();
    }

    public function global()
    {
        // Short TTL: the market numbers in here move between batches.
        $snapshot = NewsFeed::cached('global', [], fn () => NewsFeed::global(), 60);

        return $this->respond($snapshot, cacheable: $snapshot['sentiment'] !== null && !NewsRefresh::isFetching());
    }

    public function trend(Request $request)
    {
        $days = max(1, min(30, (int) $request->query('days', 7)));

        $trend = NewsFeed::cached('trend', [$days], fn () => NewsFeed::trend($days));

        return $this->respond($trend, cacheable: $trend !== [] && !NewsRefresh::isFetching());
    }

    private function respond(array $data, bool $cacheable = true): JsonResponse
    {
        $response = response()->json(['success' => true, 'data' => $data]);

        // Empty answers can't be kept: the browser would serve its copy while
        // the page checks whether the first news has arrived.
        if (!$cacheable) {
            $response->headers->set('Cache-Control', 'no-store');

            return $response;
        }

        // An unchanged feed answers If-None-Match with an empty 304.
        $response->setEtag(md5(NewsFeed::version() . request()->fullUrl() . json_encode($data)));
        $response->setCache([
            'public' => true,
            'max_age' => 60,
            'stale_while_revalidate' => 300,
        ]);
        $response->isNotModified(request());

        return $response;
    }

    private function invalid(string $message): JsonResponse
    {
        return response()->json(['success' => false, 'error' => $message], 422);
    }

    private function notFound(): JsonResponse
    {
        return response()->json(['success' => false, 'error' => 'Story not found.'], 404);
    }
}
