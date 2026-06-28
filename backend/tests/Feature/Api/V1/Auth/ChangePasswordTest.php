<?php

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\Sanctum;

test('authenticated user can change own password', function (): void {
    $user = User::factory()->create([
        'password' => Hash::make('old-password'),
    ]);

    Sanctum::actingAs($user);

    $this->postJson('/api/v1/auth/change-password', [
        'current_password' => 'old-password',
        'password' => 'new-password',
        'password_confirmation' => 'new-password',
    ])
        ->assertOk()
        ->assertJsonPath('message', 'Password changed successfully.');

    expect(Hash::check('new-password', $user->fresh()->password))->toBeTrue();
});

test('current password is required to change own password', function (): void {
    $user = User::factory()->create([
        'password' => Hash::make('old-password'),
    ]);

    Sanctum::actingAs($user);

    $this->postJson('/api/v1/auth/change-password', [
        'current_password' => 'wrong-password',
        'password' => 'new-password',
        'password_confirmation' => 'new-password',
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');

    expect(Hash::check('old-password', $user->fresh()->password))->toBeTrue();
});
