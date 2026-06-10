<?php

use Illuminate\Testing\Fluent\AssertableJson;

/**
 * US1 — Verify Platform Availability
 *
 * Tests the public GET /api/v1/health endpoint against the standard
 * success envelope: { data: { status: "ok" }, meta: {}, message: "..." }
 */
test('health endpoint returns 200 with success envelope', function (): void {
    $this->getJson('/api/v1/health')
        ->assertStatus(200)
        ->assertJson(fn (AssertableJson $json) => $json
            ->has('data')
            ->where('data.status', 'ok')
            ->has('meta')
            ->has('message')
            ->where('message', 'Service is healthy')
        );
});

test('health endpoint response has required envelope keys', function (): void {
    $this->getJson('/api/v1/health')
        ->assertStatus(200)
        ->assertJsonStructure([
            'data' => ['status'],
            'meta',
            'message',
        ]);
});
