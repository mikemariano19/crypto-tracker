<?php

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CryptoPriceController;
use App\Http\Controllers\TotalMarketCap;


Route::get('/', function () {
    view()->share('title', 'Crypto Dashboard');
    return response()->json(['message' => 'Hello from Laravel HOME']);
});

Route::get('/test', function () {
    return response()->json(['message' => 'Hello from Laravel']);
});

Route::get('/prices', function () {
    return response()->json(Cache::get([CryptoPriceController::class, 'index']));
});

Route::get('/coins', [CryptoPriceController::class, 'index']);

Route::get('/market-stats', [TotalMarketCap::class, 'index']);