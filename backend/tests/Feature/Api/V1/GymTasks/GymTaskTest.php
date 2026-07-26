<?php

use App\Models\AttendanceViolation;
use App\Models\Employee;
use App\Models\GymTask;
use App\Models\User;
use App\Support\FoundationPermissions;
use App\Support\PosPermissions;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('accountant can manage manual gym tasks and see generated alerts', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $employee = Employee::factory()->create(['name' => 'Late Captain']);
    AttendanceViolation::factory()->create([
        'employee_id' => $employee->id,
        'violation_date' => now()->toDateString(),
        'status' => 'pending',
        'notes' => 'Late check-in',
    ]);

    $response = $this->postJson('/api/v1/gym-tasks', [
        'title' => 'Check treadmill maintenance',
        'description' => 'Inspect belt and motor noise.',
        'status' => 'planned',
        'priority' => 'medium',
        'category' => 'maintenance',
        'due_date' => now()->addDay()->toDateString(),
        'assigned_employee_id' => $employee->id,
    ])
        ->assertCreated()
        ->assertJsonPath('data.title', 'Check treadmill maintenance')
        ->assertJsonPath('data.status', 'planned')
        ->assertJsonPath('data.editable', true);

    $taskId = $response->json('data.source_id');

    $this->putJson('/api/v1/gym-tasks/'.$taskId, [
        'status' => 'doing',
        'progress' => 55,
    ])
        ->assertOk()
        ->assertJsonPath('data.status', 'doing')
        ->assertJsonPath('data.progress', 55);

    $this->postJson('/api/v1/gym-tasks/'.$taskId.'/comments', [
        'body' => 'Belt is noisy. Need technician review.',
    ])
        ->assertCreated()
        ->assertJsonPath('data.body', 'Belt is noisy. Need technician review.')
        ->assertJsonPath('data.user.name', $accountant->name);

    $this->getJson('/api/v1/gym-tasks/'.$taskId)
        ->assertOk()
        ->assertJsonPath('data.metrics.comments', 1)
        ->assertJsonPath('data.comments.0.body', 'Belt is noisy. Need technician review.');

    $this->getJson('/api/v1/gym-tasks')
        ->assertOk()
        ->assertJsonFragment(['title' => 'Check treadmill maintenance'])
        ->assertJsonFragment(['title' => 'Review Late Captain attendance warning']);
});

test('users without reports permission cannot view gym tasks', function (): void {
    // Captain/Cashier now hold reports.view so they can open the Finance shift
    // desk (see RoleMatrixSeeder + HrFinanceAccessSeeder), so a roleless user is
    // the honest "lacks reports.view" subject for this gate.
    $user = User::factory()->create();
    Sanctum::actingAs($user);

    expect($user->can(PosPermissions::PERM_REPORTS_VIEW))->toBeFalse();

    GymTask::query()->create([
        'title' => 'Manager only task',
        'status' => 'planned',
        'priority' => 'medium',
        'category' => 'operations',
    ]);

    $this->getJson('/api/v1/gym-tasks')
        ->assertForbidden();
});
