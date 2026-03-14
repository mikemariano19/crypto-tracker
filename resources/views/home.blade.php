<x-layout>
    <x-slot:title>
        Home
    </x-slot:title>
    <div class="flex flex-col gap-4">
        <h1>Crypto Prices</h1>
        <p>Bitcoin: ${{ $data['bitcoin']['usd'] }}</p>
        <p>Ethereum: ${{ $data['ethereum']['usd'] }}</p>
    </div>
</x-layout>