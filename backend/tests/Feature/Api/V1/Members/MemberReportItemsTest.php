<?php

use App\Exports\MemberReportExport;
use App\Models\Employee;
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
});

test('admin can add member report records', function (): void {
    $admin = User::factory()->create();
    $admin->assignRole(FoundationPermissions::ROLE_ADMIN);
    Sanctum::actingAs($admin);

    $member = Member::factory()->create();
    $coach = Employee::factory()->captain()->create();
    Storage::fake('local');

    $this->postJson("/api/v1/members/{$member->id}/progress", [
        'recorded_on' => '2026-07-05',
        'weight_kg' => '82.50',
        'body_fat_percent' => '18.20',
        'notes' => 'Baseline check.',
    ])
        ->assertCreated()
        ->assertJsonPath('data.weight_kg', '82.50')
        ->assertJsonPath('data.body_fat_percent', '18.20');

    $this->postJson("/api/v1/members/{$member->id}/workout-plans", [
        'title' => 'Strength phase',
        'coach_id' => $coach->id,
        'starts_on' => '2026-07-06',
        'ends_on' => '2026-08-06',
        'sessions' => [
            ['title' => 'Push day'],
            ['title' => 'Pull day'],
        ],
        'notes' => 'Three days per week.',
    ])
        ->assertCreated()
        ->assertJsonPath('data.title', 'Strength phase')
        ->assertJsonPath('data.coach.id', $coach->id)
        ->assertJsonCount(2, 'data.sessions');

    $this->postJson("/api/v1/members/{$member->id}/nutrition-plans", [
        'title' => 'Lean gain',
        'coach_id' => $coach->id,
        'daily_calories' => 2400,
        'protein_grams' => 180,
        'carbs_grams' => 260,
        'fat_grams' => 70,
        'supplements' => 'Creatine',
    ])
        ->assertCreated()
        ->assertJsonPath('data.title', 'Lean gain')
        ->assertJsonPath('data.daily_calories', 2400)
        ->assertJsonPath('data.coach.id', $coach->id);

    $this->postJson("/api/v1/members/{$member->id}/bookings", [
        'title' => 'PT assessment',
        'coach_id' => $coach->id,
        'type' => 'session',
        'starts_at' => '2026-07-06T04:00:00',
        'ends_at' => '2026-07-06T06:00:00',
        'notes' => 'Initial movement screen.',
    ])
        ->assertCreated()
        ->assertJsonPath('data.title', 'PT assessment')
        ->assertJsonPath('data.type', 'session')
        ->assertJsonPath('data.status', 'scheduled')
        ->assertJsonPath('data.coach.id', $coach->id);

    $this->postJson("/api/v1/members/{$member->id}/documents", [
        'title' => 'Medical clearance',
        'type' => 'clearance',
        'document' => UploadedFile::fake()->create('clearance.pdf', 120, 'application/pdf'),
        'expires_on' => '2026-12-31',
        'notes' => 'Uploaded by front desk.',
    ])
        ->assertCreated()
        ->assertJsonPath('data.title', 'Medical clearance')
        ->assertJsonPath('data.type', 'clearance')
        ->assertJsonPath('data.expires_on', '2026-12-31')
        ->assertJsonPath('data.file_path', fn (string $path): bool => str_starts_with($path, "members/documents/{$member->id}/"));

    $documentPath = (string) $member->documents()->firstOrFail()->file_path;
    Storage::disk('local')->assertExists($documentPath);

    $this->getJson("/api/v1/members/{$member->id}/report")
        ->assertOk()
        ->assertJsonCount(1, 'data.progress')
        ->assertJsonCount(1, 'data.workout_plans')
        ->assertJsonCount(1, 'data.nutrition_plans')
        ->assertJsonCount(1, 'data.bookings')
        ->assertJsonCount(1, 'data.documents')
        ->assertJsonPath('data.workout_plans.0.title', 'Strength phase')
        ->assertJsonPath('data.nutrition_plans.0.title', 'Lean gain')
        ->assertJsonPath('data.bookings.0.title', 'PT assessment')
        ->assertJsonPath('data.documents.0.title', 'Medical clearance');

    $rows = (new MemberReportExport($member))->array();
    $flatRows = collect($rows)->flatten()->map(fn ($value): string => (string) $value)->all();
    expect($flatRows)->toContain('Progress Since Joining')
        ->and($flatRows)->toContain('82.50')
        ->and($flatRows)->toContain('Strength phase')
        ->and($flatRows)->toContain('Lean gain')
        ->and($flatRows)->toContain('PT assessment')
        ->and($flatRows)->toContain('Medical clearance');

    $this->get("/api/v1/members/{$member->id}/report/export?format=xlsx")
        ->assertOk()
        ->assertHeader(
            'content-type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        );

    $this->get("/api/v1/members/{$member->id}/report/export?format=pdf")
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');
});
