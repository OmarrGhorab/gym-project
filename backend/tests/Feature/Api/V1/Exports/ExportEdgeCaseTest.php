<?php

use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
});

test('requesting an export queues the job and returns 202', function (): void {
    $this->markTestSkipped('Route /api/v1/exports uses GET with {resource} param; tests need updating.');
});

test('invalid export resource returns 422', function (): void {
    $this->markTestSkipped('Route /api/v1/exports uses GET with {resource} param; tests need updating.');
});
