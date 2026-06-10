<?php

use Illuminate\Testing\Fluent\AssertableJson;

/**
 * US1 — Standard error contract
 *
 * Verifies that all API errors use the stable error envelope:
 *   { error: { code, message, details } }
 */
test('unknown api route returns 404 with stable error envelope', function (): void {
    $this->getJson('/api/v1/this-route-does-not-exist')
        ->assertStatus(404)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('error')
            ->has('error.code')
            ->has('error.message')
            ->has('error.details')
            ->where('error.code', 'not_found')
        );
});

test('404 response does not contain data key', function (): void {
    $this->getJson('/api/v1/this-route-does-not-exist')
        ->assertStatus(404)
        ->assertJsonMissing(['data']);
});

test('404 error message is human readable', function (): void {
    $this->getJson('/api/v1/this-route-does-not-exist')
        ->assertStatus(404)
        ->assertJsonPath('error.message', 'The requested resource was not found.');
});
