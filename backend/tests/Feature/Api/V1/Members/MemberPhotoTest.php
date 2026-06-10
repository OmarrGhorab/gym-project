<?php

use App\Models\Member;
use App\Models\User;
use App\Support\FoundationPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\MembershipAccessSeeder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(MembershipAccessSeeder::class);
    Storage::fake('local');
});

test('admin can upload a member photo', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();
    $file = UploadedFile::fake()->create('photo.jpg', 100, 'image/jpeg');

    $this->postJson("/api/v1/members/{$member->id}/photo", [
        'photo' => $file,
    ])
        ->assertStatus(200);

    $member->refresh();
    expect($member->photo_path)->not->toBeNull();
});

test('photo is stored on local disk not public', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();
    $file = UploadedFile::fake()->create('photo.jpg', 100, 'image/jpeg');

    $this->postJson("/api/v1/members/{$member->id}/photo", [
        'photo' => $file,
    ])->assertStatus(200);

    $member->refresh();
    Storage::disk('local')->assertExists($member->photo_path);
});

test('photo upload without photo field returns 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();

    $this->postJson("/api/v1/members/{$member->id}/photo", [])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('photo upload with unsupported mime type returns 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();
    $file = UploadedFile::fake()->create('document.pdf', 100, 'application/pdf');

    $this->postJson("/api/v1/members/{$member->id}/photo", [
        'photo' => $file,
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('photo upload exceeding 5MB returns 422', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();
    // Create a file > 5120 KB
    $file = UploadedFile::fake()->create('big.jpg', 6000, 'image/jpeg');

    $this->postJson("/api/v1/members/{$member->id}/photo", [
        'photo' => $file,
    ])
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed');
});

test('admin can stream a member photo', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();
    $file = UploadedFile::fake()->create('photo.jpg', 100, 'image/jpeg');

    // Upload first
    $this->postJson("/api/v1/members/{$member->id}/photo", ['photo' => $file])
        ->assertStatus(200);

    // Then stream
    $this->get("/api/v1/members/{$member->id}/photo")
        ->assertStatus(200);
});

test('get photo returns 404 when member has no photo', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create(['photo_path' => null]);

    $this->getJson("/api/v1/members/{$member->id}/photo")
        ->assertStatus(404);
});

test('unauthenticated photo upload receives 401', function (): void {
    $member = Member::factory()->create();
    $file = UploadedFile::fake()->create('photo.jpg', 100, 'image/jpeg');

    $this->postJson("/api/v1/members/{$member->id}/photo", ['photo' => $file])
        ->assertStatus(401);
});

test('unauthenticated photo stream receives 401', function (): void {
    $member = Member::factory()->create();

    $this->getJson("/api/v1/members/{$member->id}/photo")
        ->assertStatus(401);
});

test('photo upload without members.update permission receives 403', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();
    $file = UploadedFile::fake()->create('photo.jpg', 100, 'image/jpeg');

    $this->postJson("/api/v1/members/{$member->id}/photo", ['photo' => $file])
        ->assertStatus(403);
});

test('png and webp photos are accepted', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($user);

    $member = Member::factory()->create();

    $png = UploadedFile::fake()->create('photo.png', 100, 'image/png');
    $this->postJson("/api/v1/members/{$member->id}/photo", ['photo' => $png])
        ->assertStatus(200);

    $member2 = Member::factory()->create();
    $webp = UploadedFile::fake()->create('photo.webp', 100, 'image/webp');
    $this->postJson("/api/v1/members/{$member2->id}/photo", ['photo' => $webp])
        ->assertStatus(200);
});
