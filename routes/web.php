<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\CoinController;

Route::get('/', function () {
    return view('home');
});

Route::get('/coins', [CoinController::class, 'index'])->name('coins.index');