<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // One row per pipeline run, with the numbers needed to check cost.
        Schema::create('news_batches', function (Blueprint $table) {
            $table->id();
            $table->string('status', 16)->default('running'); // running | published | failed
            $table->timestamp('started_at');
            $table->timestamp('finished_at')->nullable();
            $table->timestamp('next_update_at')->nullable();
            $table->unsignedInteger('articles_fetched')->default(0);
            $table->unsignedInteger('articles_new')->default(0);
            $table->unsignedInteger('clusters_created')->default(0);
            $table->unsignedInteger('clusters_kept')->default(0);
            $table->unsignedInteger('clusters_selected')->default(0);
            $table->unsignedInteger('clusters_analyzed')->default(0);
            $table->unsignedTinyInteger('ai_requests')->default(0);
            $table->unsignedInteger('ai_input_tokens')->default(0);
            $table->unsignedInteger('ai_output_tokens')->default(0);
            $table->unsignedInteger('duration_ms')->default(0);
            $table->json('errors')->nullable();
            $table->timestamps();

            $table->index(['status', 'started_at']);
        });

        // A story: one or more articles about the same event.
        Schema::create('news_clusters', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('batch_id')->nullable()->constrained('news_batches')->nullOnDelete();
            $table->unsignedBigInteger('primary_article_id')->nullable();
            $table->unsignedSmallInteger('source_count')->default(1);
            $table->unsignedTinyInteger('trader_relevance')->default(0);
            $table->json('assets');
            $table->json('tags');
            $table->timestamp('first_published_at');
            $table->timestamp('latest_published_at');

            // pending (picked for AI) | analyzed | failed | skipped (not in top N)
            $table->string('analysis_status', 16)->default('skipped');
            $table->foreignId('analyzed_batch_id')->nullable()->constrained('news_batches')->nullOnDelete();
            $table->timestamp('analyzed_at')->nullable();
            $table->unsignedTinyInteger('sentiment_bullish')->nullable();
            $table->unsignedTinyInteger('sentiment_bearish')->nullable();
            $table->unsignedTinyInteger('sentiment_neutral')->nullable();
            $table->string('label', 8)->nullable();
            $table->string('impact', 8)->nullable();
            $table->string('confidence', 8)->nullable();
            $table->string('summary', 255)->nullable();
            $table->string('take_teaser', 150)->nullable();
            $table->string('take_view', 300)->nullable();
            $table->timestamps();

            $table->index('latest_published_at');
            $table->index(['trader_relevance', 'latest_published_at']);
            $table->index(['analysis_status', 'label']);
        });

        Schema::create('news_articles', function (Blueprint $table) {
            $table->id();
            $table->foreignUlid('cluster_id')->constrained('news_clusters')->cascadeOnDelete();
            $table->string('source', 40);
            $table->string('source_name', 80);
            $table->text('url');
            $table->char('url_hash', 64)->unique();
            $table->string('title', 500);
            $table->json('title_tokens');
            // The feed's own short description (max ~300 chars), never full text.
            $table->string('snippet', 400)->nullable();
            $table->decimal('credibility', 3, 2);
            $table->timestamp('published_at')->index();
            $table->timestamps();
        });

        // Global sentiment after each batch; history feeds the 7-day trend.
        Schema::create('news_sentiment_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('batch_id')->nullable()->constrained('news_batches')->nullOnDelete();
            $table->unsignedTinyInteger('bullish');
            $table->unsignedTinyInteger('bearish');
            $table->unsignedTinyInteger('neutral');
            $table->string('label', 8);
            $table->text('ai_summary')->nullable();
            $table->json('by_asset');
            $table->json('market')->nullable();
            $table->unsignedInteger('story_count')->default(0);
            $table->timestamps();

            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('news_sentiment_snapshots');
        Schema::dropIfExists('news_articles');
        Schema::dropIfExists('news_clusters');
        Schema::dropIfExists('news_batches');
    }
};
