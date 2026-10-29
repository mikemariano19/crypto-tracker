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
        // Numeric impact (low 1, medium 2, high 3) so "Sort: Impact" can be
        // cursor-paginated like any other column.
        Schema::table('news_clusters', function (Blueprint $table) {
            $table->unsignedTinyInteger('impact_rank')->default(1)->after('impact');
            $table->index(['impact_rank', 'trader_relevance', 'latest_published_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('news_clusters', function (Blueprint $table) {
            $table->dropIndex(['impact_rank', 'trader_relevance', 'latest_published_at']);
            $table->dropColumn('impact_rank');
        });
    }
};
