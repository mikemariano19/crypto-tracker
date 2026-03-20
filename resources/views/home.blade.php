<x-layout>
    <x-slot:title>
        Home
    </x-slot:title>
    <div class="flex flex-col gap-4">
        <h1 class="font-bold text-3xl">Crypto Prices</h1>
        <x-cryptolist :coins="$coins" />
    </div>
</x-layout>