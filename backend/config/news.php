<?php

/*
 * AI news & sentiment feed. Defaults are "budget mode" (~₱20/month of AI);
 * scaling up only means changing these env values.
 */
return [

    // How often the pipeline runs. Clamped to 2–12 by NewsSchedule.
    'fetch_interval_hours' => (int) env('NEWS_FETCH_INTERVAL_HOURS', 6),

    // Only the top N new clusters per run are sent to the AI.
    'max_analyzed_per_run' => (int) env('NEWS_MAX_ANALYZED_PER_RUN', 10),

    // Clusters scoring below this (0–100, rule-based) are left out of the feed.
    'min_relevance' => (int) env('NEWS_MIN_RELEVANCE', 40),

    // Jaccard similarity of title words needed to group two articles.
    'cluster_similarity' => (float) env('NEWS_CLUSTER_SIMILARITY', 0.6),

    // Articles about the same event must be published within this window.
    'cluster_window_hours' => 24,

    'sentiment_half_life_hours' => (float) env('NEWS_SENTIMENT_HALF_LIFE_HOURS', 12),

    'daily_ai_token_budget' => (int) env('NEWS_DAILY_AI_TOKEN_BUDGET', 60_000),

    // Longest feed description kept (also the most sent to the AI per story).
    'snippet_max_chars' => 300,

    'ai' => [
        'model' => env('AI_MODEL', 'claude-haiku-5-5'),
        'max_output_tokens' => (int) env('AI_MAX_OUTPUT_TOKENS', 2_500),
        'api_key' => env('AI_PROVIDER_API_KEY'),
    ],

];
