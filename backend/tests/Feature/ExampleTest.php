<?php

namespace Tests\Feature;

use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * The backend is API only (bootstrap/app.php loads no web routes), so the
     * health check is what hosting uses to see the app is up.
     */
    public function test_the_health_check_responds(): void
    {
        $this->get('/up')->assertOk();
    }

    public function test_there_is_no_web_front_page(): void
    {
        $this->get('/')->assertNotFound();
    }
}
