<?php

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CryptoPriceController;


Route::get('/', function () {
    return response()->json(['status' => 'Laravel is running']);
});

Route::get('/test', function () {
    return response()->json(['message' => 'Hello from Laravel']);
});

Route::get('/prices', function () {
    return response()->json(Cache::get([CryptoPriceController::class, 'index']));
});

Route::get('/coins', [CryptoPriceController::class, 'index']);