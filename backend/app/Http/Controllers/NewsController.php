<?php

namespace App\Http\Controllers;

use App\Support\News\NewsFeed;
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

        return $this->respond(NewsFeed::cached('stories', $filters, fn () => NewsFeed::stories($filters)));
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
        return $this->respond(NewsFeed::cached('global', [], fn () => NewsFeed::global(), 60));
    }

    public function trend(Request $request)
    {
        $days = max(1, min(30, (int) $request->query('days', 7)));

        return $this->respond(NewsFeed::cached('trend', [$days], fn () => NewsFeed::trend($days)));
    }

    private function respond(array $data): JsonResponse
    {
        $response = response()->json(['success' => true, 'data' => $data]);

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
