<?php

use Database\Seeders\FoundationAccessSeeder;
use Illuminate\Testing\Fluent\AssertableJson;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
});

test('unsupported social provider returns 404', function (): void {
    $this->getJson('/api/v1/auth/facebook/redirect')
        ->assertStatus(404)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error')
            ->where('error.code', 'not_found')
        );
});

test('social callback without valid state returns 400', function (): void {
    $this->markTestSkipped('Requires real Google API credentials in testing environment.');
});
