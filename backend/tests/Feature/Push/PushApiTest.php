<?php

namespace Tests\Feature\Push;

use App\Models\PushSubscription;
use App\Support\Push\PushSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PushApiTest extends TestCase
{
    use RefreshDatabase;

    private const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123';

    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        Http::preventStrayRequests();
        config(['push.vapid.public_key' => 'public', 'push.vapid.private_key' => 'private']);
        $this->app->instance(PushSender::class, new FakePushSender);
    }

    private function subscribe(array $changes = []): \Illuminate\Testing\TestResponse
    {
        return $this->postJson('/api/push/subscribe', array_replace_recursive([
            'subscription' => ['endpoint' => self::ENDPOINT, 'keys' => ['p256dh' => 'key', 'auth' => 'auth']],
            'prefs' => ['timezone' => 'Asia/Manila', 'currency' => 'php'],
        ], $changes));
    }

    public function test_key_says_whether_push_is_set_up(): void
    {
        $this->getJson('/api/push/key')->assertOk()->assertJsonPath('data', ['enabled' => true, 'publicKey' => 'public']);

        config(['push.vapid.private_key' => null]);
        $this->getJson('/api/push/key')->assertOk()->assertJsonPath('data.enabled', false);
    }

    public function test_only_real_push_services_are_accepted(): void
    {
        // The server POSTs to this address, so anything else could aim it at any host.
        foreach (['https://evil.example.com/push', 'http://fcm.googleapis.com/x', 'https://fcm.googleapis.com.evil.com/x'] as $endpoint) {
            $this->subscribe(['subscription' => ['endpoint' => $endpoint]])->assertStatus(422)->assertJsonPath('success', false);
        }

        foreach (['https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/x', 'https://wns2-par02p.notify.windows.com/w/?token=x'] as $endpoint) {
            $this->subscribe(['subscription' => ['endpoint' => $endpoint]])->assertOk();
        }
    }

    public function test_a_new_subscription_only_turns_on_price_alerts(): void
    {
        $this->subscribe()
            ->assertOk()
            ->assertJsonPath('data.subscribed', true)
            ->assertJsonPath('data.prefs.categories', ['price' => true, 'market' => false, 'brief' => false])
            ->assertJsonPath('data.prefs.timezone', 'Asia/Manila')
            ->assertJsonPath('data.prefs.quietStart', '23:00')
            ->assertJsonPath('data.prefs.quietEnd', '07:00')
            ->assertJsonPath('data.prefs.currency', 'php')
            // Nothing that identifies the browser comes back.
            ->assertJsonMissingPath('data.endpoint');
    }

    public function test_subscribing_again_keeps_settings_and_updates_keys(): void
    {
        $this->subscribe();
        $this->postJson('/api/push/prefs', ['endpoint' => self::ENDPOINT, 'prefs' => ['categories' => ['market' => true]]])->assertOk();

        $this->postJson('/api/push/subscribe', [
            'subscription' => ['endpoint' => self::ENDPOINT, 'keys' => ['p256dh' => 'new-key', 'auth' => 'new-auth']],
        ])->assertOk()->assertJsonPath('data.prefs.categories.market', true);

        $this->assertSame(1, PushSubscription::count());
        $this->assertSame('new-key', PushSubscription::first()->public_key);
    }

    public function test_unknown_browsers_get_a_404(): void
    {
        $this->postJson('/api/push/state', ['endpoint' => 'https://fcm.googleapis.com/fcm/send/other'])->assertNotFound();
        $this->postJson('/api/push/alerts', ['endpoint' => 'nope'])->assertNotFound();
    }

    public function test_alerts_are_added_listed_and_removed(): void
    {
        $this->subscribe();

        $response = $this->postJson('/api/push/alerts', [
            'endpoint' => self::ENDPOINT,
            'coinId' => 'bitcoin',
            'symbol' => 'btc',
            'direction' => 'above',
            'threshold' => 4_000_000,
            'currency' => 'php',
        ])->assertOk()
            ->assertJsonPath('data.alerts.0.coinId', 'bitcoin')
            ->assertJsonPath('data.alerts.0.direction', 'above')
            ->assertJsonPath('data.alerts.0.currency', 'php')
            ->assertJsonPath('data.alerts.0.triggeredAt', null);

        $id = $response->json('data.alerts.0.id');

        $this->postJson("/api/push/alerts/{$id}/delete", ['endpoint' => self::ENDPOINT])
            ->assertOk()
            ->assertJsonCount(0, 'data.alerts');
    }

    public function test_bad_alerts_are_rejected(): void
    {
        $this->subscribe();

        $good = ['endpoint' => self::ENDPOINT, 'coinId' => 'bitcoin', 'symbol' => 'btc', 'direction' => 'above', 'threshold' => 1, 'currency' => 'usd'];

        foreach ([['threshold' => 0], ['threshold' => -5], ['direction' => 'sideways'], ['coinId' => 'BTC!'], ['currency' => 'pesos']] as $bad) {
            $this->postJson('/api/push/alerts', [...$good, ...$bad])->assertStatus(422);
        }
    }

    public function test_alerts_are_capped_per_browser(): void
    {
        config(['push.max_alerts_per_subscription' => 2]);
        $this->subscribe();

        $alert = ['endpoint' => self::ENDPOINT, 'coinId' => 'bitcoin', 'symbol' => 'btc', 'direction' => 'above', 'threshold' => 1, 'currency' => 'usd'];

        $this->postJson('/api/push/alerts', $alert)->assertOk();
        $this->postJson('/api/push/alerts', $alert)->assertOk();
        $this->postJson('/api/push/alerts', $alert)->assertStatus(422);
    }

    public function test_alerts_from_another_browser_cannot_be_removed(): void
    {
        $this->subscribe();
        $id = $this->postJson('/api/push/alerts', [
            'endpoint' => self::ENDPOINT, 'coinId' => 'bitcoin', 'symbol' => 'btc', 'direction' => 'above', 'threshold' => 1, 'currency' => 'usd',
        ])->json('data.alerts.0.id');

        $other = 'https://fcm.googleapis.com/fcm/send/other';
        $this->subscribe(['subscription' => ['endpoint' => $other]]);

        $this->postJson("/api/push/alerts/{$id}/delete", ['endpoint' => $other])->assertOk();
        $this->postJson('/api/push/state', ['endpoint' => self::ENDPOINT])->assertJsonCount(1, 'data.alerts');
    }

    public function test_settings_are_validated(): void
    {
        $this->subscribe();

        foreach ([['timezone' => 'Mars/Base'], ['quietStart' => '25:00'], ['briefTime' => '8am'], ['currency' => 'PHP!']] as $bad) {
            $this->postJson('/api/push/prefs', ['endpoint' => self::ENDPOINT, 'prefs' => $bad])->assertStatus(422);
        }

        $this->postJson('/api/push/prefs', ['endpoint' => self::ENDPOINT, 'prefs' => [
            'categories' => ['brief' => true, 'unknown' => true],
            'quietStart' => null,
            'briefTime' => '07:30',
            'priceAlertsInQuiet' => true,
        ]])->assertOk()
            ->assertJsonPath('data.prefs.categories', ['price' => true, 'market' => false, 'brief' => true])
            ->assertJsonPath('data.prefs.quietStart', null)
            ->assertJsonPath('data.prefs.briefTime', '07:30')
            ->assertJsonPath('data.prefs.priceAlertsInQuiet', true);
    }

    public function test_only_a_new_brief_time_lets_todays_brief_come_again(): void
    {
        $this->subscribe();
        PushSubscription::first()->update(['last_brief_on' => '2026-11-08', 'brief_time' => '08:00']);

        $this->postJson('/api/push/prefs', ['endpoint' => self::ENDPOINT, 'prefs' => ['briefTime' => '08:00', 'quietStart' => '22:00']]);
        $this->assertNotNull(PushSubscription::first()->last_brief_on);

        $this->postJson('/api/push/prefs', ['endpoint' => self::ENDPOINT, 'prefs' => ['briefTime' => '18:00']]);
        $this->assertNull(PushSubscription::first()->last_brief_on);
    }

    public function test_unsubscribing_removes_everything(): void
    {
        $this->subscribe();
        $this->postJson('/api/push/alerts', [
            'endpoint' => self::ENDPOINT, 'coinId' => 'bitcoin', 'symbol' => 'btc', 'direction' => 'above', 'threshold' => 1, 'currency' => 'usd',
        ]);

        $this->postJson('/api/push/unsubscribe', ['endpoint' => self::ENDPOINT])->assertOk();

        $this->assertSame(0, PushSubscription::count());
        $this->assertDatabaseCount('price_alerts', 0);
    }

    public function test_the_cron_endpoint_needs_its_secret(): void
    {
        // Off until a secret is set.
        $this->postJson('/api/push/check')->assertNotFound();

        config(['push.cron_secret' => 'right']);

        $this->postJson('/api/push/check', [], ['X-Cron-Secret' => 'wrong'])->assertNotFound();
        Http::fake(['*' => Http::response([], 500)]);
        $this->postJson('/api/push/check', [], ['X-Cron-Secret' => 'right'])->assertOk()->assertJsonPath('data.ran', true);
    }
}
