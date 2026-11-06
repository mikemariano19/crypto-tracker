<?php

namespace App\Support;

use Anthropic\Client;
use GuzzleHttp\Client as Guzzle;
use Psr\Http\Client\ClientInterface;

/**
 * The one place that calls the Claude API: sends a prompt, asks for JSON that
 * fits a schema, and reports what came back. Each feature extends this with its
 * own prompt and schema.
 */
abstract class ClaudeJsonClient
{
    public const STATUS_OK = 'ok';

    // Claude declined, or the answer was cut off or unreadable.
    public const STATUS_UNUSABLE = 'unusable';

    protected const TIMEOUT_SECONDS = 120;

    // Null keeps the SDK's default of 2 retries.
    protected const ?int MAX_RETRIES = null;

    public function __construct(private ?ClientInterface $transporter = null) {}

    public function isConfigured(): bool
    {
        return filled(config('news.ai.api_key'));
    }

    /**
     * @return array{status: string, data: ?array, input_tokens: int, output_tokens: int, reason: ?string}
     */
    protected function requestJson(string $system, string $content, array $schema, int $maxTokens, string $effort, ?float $timeoutSeconds = null): array
    {
        $timeout = min($timeoutSeconds ?? static::TIMEOUT_SECONDS, static::TIMEOUT_SECONDS);

        $client = new Client(
            apiKey: (string) config('news.ai.api_key'),
            requestOptions: [
                // The SDK retries rate limits and server errors; this keeps a
                // stuck connection from holding the queue worker.
                'transporter' => $this->transporter ?? new Guzzle(['timeout' => $timeout]),
                ...(static::MAX_RETRIES === null ? [] : ['maxRetries' => static::MAX_RETRIES]),
            ],
        );

        $message = $client->messages->create(
            model: (string) config('news.ai.model'),
            // Thinking counts toward this cap, so it can't be sized to the answer alone.
            maxTokens: $maxTokens,
            system: $system,
            messages: [['role' => 'user', 'content' => $content]],
            outputConfig: [
                'effort' => $effort,
                'format' => ['type' => 'json_schema', 'schema' => $schema],
            ],
        );

        // Usage is billed even when the answer can't be used.
        $usage = $message->usage;
        $result = [
            'status' => self::STATUS_UNUSABLE,
            'data' => null,
            'input_tokens' => (int) $usage->inputTokens + (int) $usage->cacheCreationInputTokens + (int) $usage->cacheReadInputTokens,
            'output_tokens' => (int) $usage->outputTokens,
            'reason' => null,
        ];

        // Check first: a refused or cut-off answer has no complete JSON to read.
        if ($message->stopReason !== 'end_turn') {
            return [...$result, 'reason' => 'stop_reason: ' . $message->stopReason];
        }

        // Thinking blocks can come first, so find the answer by type.
        foreach ($message->content as $block) {
            if ($block->type === 'text') {
                $data = json_decode($block->text, true);

                return is_array($data)
                    ? [...$result, 'status' => self::STATUS_OK, 'data' => $data]
                    : [...$result, 'reason' => 'response was not JSON'];
            }
        }

        return [...$result, 'reason' => 'no text in response'];
    }
}
