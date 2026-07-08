<?php

use App\Models\AttendanceViolation;
use App\Models\Employee;
use App\Models\Member;
use App\Models\MemberVisit;
use App\Models\OperationsCalendarEvent;
use App\Models\Payroll;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Subscription;
use App\Models\User;
use App\Support\FoundationPermissions;
use Carbon\Carbon;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Laravel\Sanctum\Sanctum;

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

test('accountant can view operations summary', function (): void {
    Carbon::setTestNow('2026-06-29 10:30:00');

    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $employee = Employee::factory()->create(['name' => 'Late Captain']);
    AttendanceViolation::factory()->create([
        'employee_id' => $employee->id,
        'violation_date' => Carbon::today()->toDateString(),
        'status' => 'pending',
    ]);
    Payroll::factory()->create([
        'employee_id' => $employee->id,
        'month' => '2026-06',
        'status' => 'pending',
    ]);

    $member = Member::factory()->create(['name' => 'Renewal Member']);
    $plan = Plan::factory()->create(['name' => 'Monthly']);
    Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'end_date' => Carbon::today()->addDays(3)->toDateString(),
        'price_paid' => '500.00',
        'status' => 'active',
    ]);
    MemberVisit::factory()->create([
        'member_id' => $member->id,
        'check_in_at' => Carbon::now(),
        'status' => 'blocked',
        'alert_reason' => 'Expired subscription',
    ]);
    Product::factory()->lowStock()->create(['name' => 'Protein Bar']);

    $this->getJson('/api/v1/reports/operations-summary')
        ->assertOk()
        ->assertJsonPath('data.summary.pending_review_count', 2)
        ->assertJsonPath('data.summary.focus_href', '/dashboard/attendance')
        ->assertJsonFragment(['title' => 'Review Late Captain attendance warning'])
        ->assertJsonFragment(['title' => 'Restock Protein Bar'])
        ->assertJsonFragment(['tag' => 'Payroll', 'href' => '/dashboard/payroll'])
        ->assertJsonFragment(['tag' => 'Inventory', 'href' => '/dashboard/logistics'])
        ->assertJsonStructure([
            'data' => [
                'generated_at',
                'summary' => ['today_action_count', 'pending_review_count', 'week_progress', 'focus_title', 'focus_description', 'focus_href'],
                'tasks' => [
                    '*' => ['id', 'title', 'tag', 'priority', 'due_label', 'href'],
                ],
                'workflows' => [
                    '*' => ['title', 'status', 'description', 'progress', 'footer', 'href'],
                ],
                'quick_actions' => [
                    '*' => ['label', 'href'],
                ],
                'calendar_events' => [
                    '*' => ['date', 'title', 'type'],
                ],
                'activity',
                'week' => ['label', 'progress', 'completed', 'total', 'member_visits', 'subscriptions_renewed', 'sales', 'payroll_paid'],
            ],
        ]);
});

test('users without reports permission cannot view operations summary', function (): void {
    $user = User::factory()->create();
    $user->assignRole(FoundationPermissions::ROLE_CAPTAIN);
    Sanctum::actingAs($user);

    $this->getJson('/api/v1/reports/operations-summary')
        ->assertForbidden();
});

test('accountant can create operations calendar event', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $this->postJson('/api/v1/reports/operations-calendar-events', [
        'date' => '2026-07-05',
        'title' => 'Staff meeting',
        'type' => 'manual',
        'notes' => 'Review new shift rules.',
    ])
        ->assertCreated()
        ->assertJsonPath('data.title', 'Staff meeting')
        ->assertJsonPath('data.date', '2026-07-05');

    $this->getJson('/api/v1/reports/operations-summary')
        ->assertOk()
        ->assertJsonFragment(['title' => 'Staff meeting']);
});

test('accountant can create operations calendar event with custom type label and multiple employees', function (): void {
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    $firstEmployee = Employee::factory()->create(['name' => 'Sara Coach']);
    $secondEmployee = Employee::factory()->create(['name' => 'Omar Coach']);

    $this->postJson('/api/v1/reports/operations-calendar-events', [
        'date' => '2026-07-06',
        'title' => 'Coach huddle',
        'type' => 'manual',
        'custom_type_label' => 'Coach meeting',
        'assigned_employee_ids' => [$firstEmployee->id, $secondEmployee->id],
        'notes' => 'Plan studio handoff.',
    ])
        ->assertCreated()
        ->assertJsonPath('data.type', 'manual')
        ->assertJsonPath('data.custom_type_label', 'Coach meeting')
        ->assertJsonPath('data.assigned_employee.id', $firstEmployee->id)
        ->assertJsonCount(2, 'data.assigned_employees')
        ->assertJsonPath('data.assigned_employees.0.name', 'Sara Coach')
        ->assertJsonPath('data.assigned_employees.1.name', 'Omar Coach');

    $event = OperationsCalendarEvent::query()->latest('id')->firstOrFail();

    expect($event->assigned_employee_id)->toBe($firstEmployee->id)
        ->and($event->assigned_employee_ids)->toBe([$firstEmployee->id, $secondEmployee->id])
        ->and($event->custom_type_label)->toBe('Coach meeting');
});
