<?php

namespace App\Http\Controllers;

use App\Models\PriceAlert;
use App\Models\PushSubscription;
use App\Support\Push\PushCheck;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Web push alerts, with no accounts: the browser's push subscription
 * endpoint identifies it. It's sent in POST bodies, never in URLs, so it
 * stays out of access logs.
 */
class PushController extends Controller
{
    private const TIME = '/^([01]\d|2[0-3]):[0-5]\d$/';

    private const DEFAULT_PREFS = [
        // Opt-in: setting a price alert is the action that turned push on.
        // Market alerts and the brief wait until the user switches them on.
        'categories' => ['price' => true, 'market' => false, 'brief' => false],
        'quietStart' => '23:00',
        'quietEnd' => '07:00',
        'priceAlertsInQuiet' => false,
        'briefTime' => '08:00',
    ];

    /** The public VAPID key the browser subscribes with, if push is set up. */
    public function key(): JsonResponse
    {
        $key = config('push.vapid.public_key');

        return response()->json(['success' => true, 'data' => [
            'enabled' => filled($key) && filled(config('push.vapid.private_key')),
            'publicKey' => $key ?: null,
        ]]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'subscription.endpoint' => ['required', 'string', 'max:2000', 'url:https', fn ($attribute, $value, $fail) => $this->isPushService($value) || $fail('Unsupported push service.')],
            'subscription.keys.p256dh' => ['required', 'string', 'max:200'],
            'subscription.keys.auth' => ['required', 'string', 'max:100'],
            'contentEncoding' => ['nullable', Rule::in(['aes128gcm', 'aesgcm'])],
            ...$this->prefsRules(),
        ]);

        if ($validator->fails()) {
            return $this->invalid($validator->errors()->first());
        }

        $endpoint = $request->input('subscription.endpoint');
        $subscription = PushSubscription::findByEndpoint($endpoint);
        $prefs = $request->input('prefs', []);

        $keys = [
            'public_key' => $request->input('subscription.keys.p256dh'),
            'auth_token' => $request->input('subscription.keys.auth'),
            'content_encoding' => $request->input('contentEncoding') ?: 'aes128gcm',
        ];

        if ($subscription) {
            // Keys can rotate; settings stay as they were unless sent.
            $subscription->update([...$keys, ...$this->prefsColumns($prefs)]);
        } else {
            $subscription = PushSubscription::create([
                'endpoint' => $endpoint,
                'endpoint_hash' => PushSubscription::hashEndpoint($endpoint),
                ...$keys,
                ...$this->prefsColumns([...self::DEFAULT_PREFS, ...$prefs]),
            ]);
        }

        return $this->state($subscription->refresh());
    }

    public function show(Request $request): JsonResponse
    {
        return $this->withSubscription($request, fn (PushSubscription $subscription) => $this->state($subscription));
    }

    public function updatePrefs(Request $request): JsonResponse
    {
        return $this->withSubscription($request, function (PushSubscription $subscription) use ($request) {
            $validator = Validator::make($request->all(), $this->prefsRules());

            if ($validator->fails()) {
                return $this->invalid($validator->errors()->first());
            }

            $columns = $this->prefsColumns($request->input('prefs', []));

            // A new brief time means today's brief can still come.
            if (array_key_exists('brief_time', $columns) && $columns['brief_time'] !== $subscription->brief_time) {
                $columns['last_brief_on'] = null;
            }

            $subscription->update($columns);

            return $this->state($subscription->refresh());
        });
    }

    public function storeAlert(Request $request): JsonResponse
    {
        return $this->withSubscription($request, function (PushSubscription $subscription) use ($request) {
            $validator = Validator::make($request->all(), [
                'coinId' => ['required', 'string', 'max:100', 'regex:/^[a-z0-9-]+$/'],
                'symbol' => ['required', 'string', 'max:20'],
                'direction' => ['required', Rule::in(PriceAlert::DIRECTIONS)],
                'threshold' => ['required', 'numeric', 'gt:0', 'lt:1e15'],
                'currency' => ['required', 'string', 'regex:/^[a-z]{3}$/'],
            ]);

            if ($validator->fails()) {
                return $this->invalid($validator->errors()->first());
            }

            $active = $subscription->alerts()->whereNull('triggered_at')->count();

            if ($active >= (int) config('push.max_alerts_per_subscription')) {
                return $this->invalid('You have the most price alerts allowed. Remove one to add another.');
            }

            $subscription->alerts()->create([
                'coin_id' => $request->input('coinId'),
                'coin_symbol' => mb_substr($request->input('symbol'), 0, 20),
                'direction' => $request->input('direction'),
                'threshold' => (float) $request->input('threshold'),
                'currency' => $request->input('currency'),
            ]);

            // Asking for alerts is the clearest sign this category is wanted.
            if (!$subscription->wants('price')) {
                $subscription->update(['categories' => [...$subscription->categories, 'price' => true]]);
            }

            return $this->state($subscription->refresh());
        });
    }

    public function destroyAlert(Request $request, int $id): JsonResponse
    {
        return $this->withSubscription($request, function (PushSubscription $subscription) use ($id) {
            $subscription->alerts()->whereKey($id)->delete();

            return $this->state($subscription->refresh());
        });
    }

    public function unsubscribe(Request $request): JsonResponse
    {
        PushSubscription::findByEndpoint((string) $request->input('endpoint'))?->delete();

        return response()->json(['success' => true, 'data' => ['subscribed' => false]]);
    }

    /**
     * For a free external scheduler, so alerts still go out while the server
     * would be asleep. The secret keeps anyone else from running it.
     */
    public function check(Request $request, PushCheck $check): JsonResponse
    {
        $secret = (string) config('push.cron_secret');

        if ($secret === '' || !hash_equals($secret, (string) $request->header('X-Cron-Secret'))) {
            return response()->json(['success' => false, 'error' => 'Not found.'], 404);
        }

        return response()->json(['success' => true, 'data' => $check->run()]);
    }

    private function isPushService(string $endpoint): bool
    {
        $host = strtolower((string) parse_url($endpoint, PHP_URL_HOST));

        foreach (config('push.allowed_hosts') as $allowed) {
            if ($host === $allowed || str_ends_with($host, '.' . $allowed)) {
                return true;
            }
        }

        return false;
    }

    private function prefsRules(): array
    {
        return [
            'prefs' => ['sometimes', 'array'],
            'prefs.categories' => ['sometimes', 'array'],
            'prefs.categories.*' => ['boolean'],
            'prefs.timezone' => ['sometimes', 'string', Rule::in(timezone_identifiers_list())],
            'prefs.quietStart' => ['sometimes', 'nullable', 'regex:' . self::TIME],
            'prefs.quietEnd' => ['sometimes', 'nullable', 'regex:' . self::TIME],
            'prefs.priceAlertsInQuiet' => ['sometimes', 'boolean'],
            'prefs.briefTime' => ['sometimes', 'nullable', 'regex:' . self::TIME],
            'prefs.currency' => ['sometimes', 'string', 'regex:/^[a-z]{3}$/'],
        ];
    }

    /** Only the settings that were sent, as columns. */
    private function prefsColumns(array $prefs): array
    {
        $columns = [];

        if (array_key_exists('categories', $prefs)) {
            $columns['categories'] = array_map('boolval', array_intersect_key(
                [...self::DEFAULT_PREFS['categories'], ...$prefs['categories']],
                array_flip(PushSubscription::CATEGORIES),
            ));
        }

        foreach ([
            'timezone' => 'timezone',
            'quietStart' => 'quiet_start',
            'quietEnd' => 'quiet_end',
            'priceAlertsInQuiet' => 'price_alerts_in_quiet',
            'briefTime' => 'brief_time',
            'currency' => 'currency',
        ] as $key => $column) {
            if (array_key_exists($key, $prefs)) {
                $columns[$column] = $key === 'priceAlertsInQuiet' ? (bool) $prefs[$key] : $prefs[$key];
            }
        }

        return $columns;
    }

    private function withSubscription(Request $request, \Closure $then): JsonResponse
    {
        $subscription = PushSubscription::findByEndpoint((string) $request->input('endpoint'));

        if (!$subscription) {
            return response()->json(['success' => false, 'error' => 'This browser is not subscribed to alerts.'], 404);
        }

        return $then($subscription);
    }

    private function state(PushSubscription $subscription): JsonResponse
    {
        return response()->json(['success' => true, 'data' => [
            'subscribed' => true,
            'prefs' => $subscription->prefs(),
            'alerts' => $subscription->alerts()->latest('id')->get()->map->toApi()->all(),
            'history' => $subscription->notifications()->latest('sent_at')->limit(30)->get()->map->toApi()->all(),
        ]], 200, ['Cache-Control' => 'no-store']);
    }

    private function invalid(string $message): JsonResponse
    {
        return response()->json(['success' => false, 'error' => $message], 422);
    }
}
