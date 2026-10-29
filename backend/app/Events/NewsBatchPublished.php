<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class NewsBatchPublished implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(
        public int $batchId,
        public int $newCount,
        public string $updatedAt,
    ) {}

    public function broadcastOn(): Channel
    {
        return new Channel('news');
    }

    public function broadcastAs(): string
    {
        return 'news.batch.published';
    }

    public function broadcastWith(): array
    {
        return [
            'batchId' => $this->batchId,
            'newCount' => $this->newCount,
            'updatedAt' => $this->updatedAt,
        ];
    }
}
