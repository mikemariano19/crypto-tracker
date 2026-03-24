<table class="w-full text-sm">
    <thead>
        <tr class="text-left border-b">
            <th>#</th>
            <th>Coin</th>
            <th>Price</th>
            <th>1h</th>
            <th>24h</th>
            <th>7d</th>
        </tr>
    </thead>

    <tbody>
        @foreach ($coins ?? [] as $coin)
            @php
                $change1h = $coin['price_change_percentage_1h_in_currency'] ?? 0;
                $change24h = $coin['price_change_percentage_24h'] ?? 0;
                $change7d = $coin['price_change_percentage_7d_in_currency'] ?? 0;
            @endphp

            <tr class="border-b hover:bg-gray-50">

                {{-- Rank --}}
                <td>{{ $coin['market_cap_rank'] ?? 'N/A' }}</td>

                {{-- Coin --}}
                <td class="flex items-center gap-2 py-2">
                    <img 
                        src="{{ $coin['image'] ?? 'https://via.placeholder.com/20' }}" 
                        width="20"
                    >
                    <span>
                        {{ $coin['name'] ?? 'Unknown' }}
                        <span class="text-gray-500">
                            {{ strtoupper($coin['symbol'] ?? '') }}
                        </span>
                    </span>
                </td>

                {{-- Price --}}
                <td>
                    ${{ number_format($coin['current_price'] ?? 0, 2) }}
                </td>

                {{-- 1h --}}
                <td class="{{ $change1h > 0 ? 'text-green-500' : ($change1h < 0 ? 'text-red-500' : 'text-gray-500') }}">
                    {{ number_format($change1h, 2) }}%
                </td>

                {{-- 24h --}}
                <td class="{{ $change24h > 0 ? 'text-green-500' : ($change24h < 0 ? 'text-red-500' : 'text-gray-500') }}">
                    {{ number_format($change24h, 2) }}%
                </td>

                {{-- 7d --}}
                <td class="{{ $change7d > 0 ? 'text-green-500' : ($change7d < 0 ? 'text-red-500' : 'text-gray-500') }}">
                    {{ number_format($change7d, 2) }}%
                </td>

            </tr>
        @endforeach
    </tbody>
</table>








{{-- <div class="flex items-center gap-4 p-4 border rounded">
        <img src="{{ $coin['image'] }}" alt="{{ $coin['name'] }}" class="w-10 h-10">
        <div>
            <h2 class="font-bold text-lg">{{ $coin['name'] }} ({{ strtoupper($coin['symbol']) }})</h2>
            <p class="text-gray-600">Price: ${{ number_format($coin['current_price'], 2) }}</p>
            <p class="text-gray-600">Market Cap: ${{ number_format($coin['market_cap'], 0) }}</p>
        </div>
    </div>
     --}}