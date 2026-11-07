<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Web push alerts. There are no accounts: a browser's push subscription is
     * its identity, and nothing here says who the person is or what they own.
     */
    public function up(): void
    {
        Schema::create('push_subscriptions', function (Blueprint $table) {
            $table->id();
            // Endpoints are long URLs, so lookups go through their hash.
            $table->text('endpoint');
            $table->string('endpoint_hash', 64)->unique();
            $table->string('public_key');
            $table->string('auth_token');
            $table->string('content_encoding', 16)->default('aes128gcm');
            $table->string('timezone', 64)->default('UTC');
            // Which kinds of alert this browser wants: {price, market, brief}.
            $table->json('categories');
            // "HH:MM" in the subscriber's time zone. Null start means no quiet hours.
            $table->string('quiet_start', 5)->nullable();
            $table->string('quiet_end', 5)->nullable();
            $table->boolean('price_alerts_in_quiet')->default(false);
            $table->string('brief_time', 5)->nullable();
            $table->date('last_brief_on')->nullable();
            // Prices in briefs and market alerts are shown in this currency.
            $table->string('currency', 8)->default('usd');
            $table->timestamps();
        });

        Schema::create('price_alerts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('push_subscription_id')->constrained()->cascadeOnDelete();
            $table->string('coin_id', 100);
            $table->string('coin_symbol', 20);
            $table->string('direction', 5); // above | below
            // In the currency the user typed it in, so "above ₱4,000,000" is exact.
            $table->double('threshold');
            $table->string('currency', 8);
            $table->timestamp('triggered_at')->nullable();
            $table->timestamps();

            $table->index(['triggered_at', 'coin_id']);
        });

        Schema::create('push_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('push_subscription_id')->constrained()->cascadeOnDelete();
            $table->string('category', 16);
            // For the per-coin cooldown. One notification can cover several coins.
            $table->json('coin_ids');
            $table->string('title');
            $table->string('body', 500);
            $table->string('url');
            $table->timestamp('sent_at');

            $table->index(['push_subscription_id', 'sent_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_notifications');
        Schema::dropIfExists('price_alerts');
        Schema::dropIfExists('push_subscriptions');
    }
};
