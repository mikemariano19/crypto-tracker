<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcast;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class CryptoPricesUpdated implements ShouldBroadcast
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public function __construct(public array $prices) {}

    public function broadcastOn(): Channel
    {
        return new Channel('crypto-prices');
    }

    public function broadcastAs(): string
    {
        return 'prices.updated';
    }

    public function broadcastWith(): array
    {
        return ['prices' => $this->prices];
    }
}