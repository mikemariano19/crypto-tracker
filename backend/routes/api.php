<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CryptoPriceController;
use App\Http\Controllers\MarketController;
use App\Http\Controllers\NewsController;
use App\Http\Controllers\TopGainerController;
use App\Http\Controllers\WalletProviderController;


Route::get('/', function () {
    view()->share('title', 'Crypto Dashboard');
    return response()->json(['message' => 'Hello from Laravel HOME']);
});

Route::get('/test', function () {
    return response()->json(['message' => 'Hello from Laravel']);
});


Route::get('/coin', [CryptoPriceController::class, 'index']);
Route::get('/coin/{id}', [CryptoPriceController::class, 'coin']);
Route::get('/coin/{id}/chart', [CryptoPriceController::class, 'chart']);
Route::get('/coin/{id}/markets', [CryptoPriceController::class, 'markets']);
Route::get('/top-gainers', [TopGainerController::class, 'index']);

// Wallet tracker: prices for the coins in the user's (browser-only) wallets.
Route::get('/prices', [CryptoPriceController::class, 'prices']);
Route::get('/coin-list', [MarketController::class, 'coinList']);
Route::get('/wallet-providers', [WalletProviderController::class, 'index']);
Route::get('/wallet-providers/{id}/icon', [WalletProviderController::class, 'icon']);


Route::get('/market-stats', [MarketController::class, 'global']);
Route::get('/trending', [MarketController::class, 'trending']);
Route::get('/fear-greed', [MarketController::class, 'fearGreed']);
Route::get('/exchange-rates', [MarketController::class, 'exchangeRates']);
Route::get('/search', [MarketController::class, 'search']);

Route::get('/news/sentiment/global', [NewsController::class, 'global']);
Route::get('/news/sentiment/trend', [NewsController::class, 'trend']);
Route::get('/news', [NewsController::class, 'index']);
Route::get('/news/{clusterId}', [NewsController::class, 'show']);

