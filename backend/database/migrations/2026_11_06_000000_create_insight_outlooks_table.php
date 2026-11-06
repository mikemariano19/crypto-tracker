<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('insight_outlooks', function (Blueprint $table) {
            $table->id();
            $table->string('coin_id', 100);
            $table->string('timeframe', 4);
            $table->string('label', 8);
            $table->double('price');
            $table->timestamp('analyzed_at');
            $table->timestamp('resolve_at');
            // Empty until the outcome is known.
            $table->timestamp('resolved_at')->nullable();
            $table->double('move_pct')->nullable();
            // Stays empty if the check ran too late to be a fair comparison.
            $table->boolean('matched')->nullable();

            $table->index(['resolved_at', 'resolve_at']);
            $table->index(['timeframe', 'analyzed_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('insight_outlooks');
    }
};
