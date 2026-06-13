<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // Tests do not send X-API-Key; keep the gate off so feature tests exercise auth only.
        config(['services.frontend.api_key' => '']);
    }
}
