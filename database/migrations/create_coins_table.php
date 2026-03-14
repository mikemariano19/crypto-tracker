<?php

public function up()
    {
        Schema::create('coins', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('symbol')->unique();
            $table->decimal('price', 20, 8);
            $table->decimal('market_cap', 20, 2);
            $table->decimal('volume_24h', 20, 2);
            $table->decimal('percent_change_1h', 5, 2);
            $table->decimal('percent_change_24h', 5, 2);
            $table->decimal('percent_change_7d', 5, 2);
            $table->timestamps();
        });
    }
