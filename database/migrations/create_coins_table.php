<?php

public function up()
{
    Schema::create('coins', function (Blueprint $table) {
        $table->id();
        $table->string('name');
        $table->string('symbol');
        $table->decimal('price', 20, 8);
        $table->timestamps();
    });
}