<?php

use App\Models\Employee;
use App\Models\Member;
use App\Models\MemberVisit;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\SubscriptionFreeze;
use App\Models\SubscriptionRefund;
use App\Models\User;
use App\Support\FoundationPermissions;
use Carbon\Carbon;
use Database\Seeders\FoundationAccessSeeder;
use Database\Seeders\HrFinanceAccessSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(FoundationAccessSeeder::class);
    $this->seed(HrFinanceAccessSeeder::class);
});

function actAsReportViewer(): User
{
    $accountant = User::factory()->create();
    $accountant->assignRole(FoundationPermissions::ROLE_ACCOUNTANT);
    Sanctum::actingAs($accountant);

    return $accountant;
}

test('report returns one row per member built from the latest subscription', function (): void {
    Carbon::setTestNow('2026-07-20 12:00:00');
    actAsReportViewer();

    $coach = Employee::factory()->create(['name' => 'Coach Omar', 'role' => 'Coach', 'status' => 'active']);
    $seller = User::factory()->create(['name' => 'Reception Mona']);
    $member = Member::factory()->create(['name' => 'Member Sherif', 'phone' => '01000000001']);

    $oldPlan = Plan::factory()->create(['name' => 'Old Monthly']);
    $currentPlan = Plan::factory()->create(['name' => 'Gold Monthly', 'access_grace_days' => 0]);

    Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $oldPlan->id,
        'status' => 'expired',
        'start_date' => '2026-05-01',
        'end_date' => '2026-05-31',
        'price_paid' => '500.00',
    ]);

    $latest = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $currentPlan->id,
        'coach_id' => $coach->id,
        'sold_by_user_id' => $seller->id,
        'status' => 'active',
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
        'price_paid' => '800.00',
        'discount' => '50.00',
        'sessions_total' => 12,
        'sessions_remaining' => 8,
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $latest->id,
        'amount' => '600.00',
        'status' => 'paid',
        'paid_at' => '2026-07-01 10:00:00',
    ]);

    foreach (['2026-07-02 09:00:00', '2026-07-04 09:00:00', '2026-07-04 18:00:00', '2026-07-09 09:00:00'] as $checkIn) {
        MemberVisit::query()->create([
            'member_id' => $member->id,
            'subscription_id' => $latest->id,
            'check_in_at' => $checkIn,
            'status' => 'allowed',
        ]);
    }

    $this->getJson('/api/v1/reports/member-subscriptions')
        ->assertOk()
        ->assertJsonPath('data.totals.members_count', 1)
        ->assertJsonPath('data.totals.active_count', 1)
        ->assertJsonPath('data.members.0.member_name', 'Member Sherif')
        ->assertJsonPath('data.members.0.subscriptions_count', 2)
        ->assertJsonPath('data.members.0.latest.plan_name', 'Gold Monthly')
        ->assertJsonPath('data.members.0.latest.status', 'active')
        ->assertJsonPath('data.members.0.latest.coach_name', 'Coach Omar')
        ->assertJsonPath('data.members.0.latest.sold_by', 'Reception Mona')
        ->assertJsonPath('data.members.0.latest.sessions_total', 12)
        ->assertJsonPath('data.members.0.latest.sessions_remaining', 8)
        ->assertJsonPath('data.members.0.latest.sessions_used', 4)
        ->assertJsonPath('data.members.0.latest.visits_count', 4)
        ->assertJsonPath('data.members.0.latest.visit_days_count', 3)
        ->assertJsonPath('data.members.0.latest.attendance_rate', 33.3)
        ->assertJsonPath('data.members.0.latest.price_paid', '800.00')
        ->assertJsonPath('data.members.0.latest.package_paid_total', '600.00')
        ->assertJsonPath('data.members.0.latest.package_balance', '200.00')
        ->assertJsonPath('data.members.0.latest.payments_count', 1)
        ->assertJsonPath('data.members.0.latest.billing_status', 'pending')
        ->assertJsonPath('data.members.0.latest.days_left', 11);
});

test('frozen membership report protects remaining days and shows projected expiry', function (): void {
    Carbon::setTestNow('2026-08-16 12:00:00');
    actAsReportViewer();

    $subscription = Subscription::factory()->frozen()->create([
        'member_id' => Member::factory()->create()->id,
        'start_date' => '2026-08-13',
        'end_date' => '2026-09-12',
    ]);
    SubscriptionFreeze::factory()->create([
        'subscription_id' => $subscription->id,
        'freeze_start' => '2026-08-14',
        'freeze_end' => '2026-08-20',
        'days' => 7,
        'remaining_days_at_freeze' => 29,
        'resumed_on' => null,
    ]);

    $this->getJson('/api/v1/reports/member-subscriptions')
        ->assertOk()
        ->assertJsonPath('data.members.0.latest.original_end_date', '2026-09-12')
        ->assertJsonPath('data.members.0.latest.end_date', '2026-09-19')
        ->assertJsonPath('data.members.0.latest.days_left', 29)
        ->assertJsonPath('data.members.0.latest.freeze_days_used', 7)
        ->assertJsonPath('data.members.0.latest.is_frozen', true);

    $this->getJson('/api/v1/reports/member-subscriptions?from=2026-09-15&to=2026-09-18')
        ->assertOk()
        ->assertJsonPath('data.totals.members_count', 1)
        ->assertJsonPath('data.members.0.latest.end_date', '2026-09-19');
});

test('report rolls add-on price, payments and visits into the package figures', function (): void {
    Carbon::setTestNow('2026-07-20 12:00:00');
    actAsReportViewer();

    $coach = Employee::factory()->create(['name' => 'Coach Ali', 'role' => 'Coach', 'status' => 'active']);
    $member = Member::factory()->create(['name' => 'Member Nour']);
    $subscription = Subscription::factory()->create([
        'member_id' => $member->id,
        'status' => 'active',
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
        'price_paid' => '800.00',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '800.00',
        'status' => 'paid',
    ]);

    $addon = SubscriptionAddon::query()->create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => Plan::factory()->create(['name' => 'PT 10 Sessions'])->id,
        'coach_id' => $coach->id,
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
        'status' => 'active',
        'price_paid' => '1200.00',
        'sessions_total' => 10,
        'sessions_remaining' => 8,
    ]);

    Payment::factory()->create([
        'payable_type' => SubscriptionAddon::class,
        'payable_id' => $addon->id,
        'amount' => '500.00',
        'status' => 'partial',
    ]);

    MemberVisit::query()->create([
        'member_id' => $member->id,
        'subscription_id' => $subscription->id,
        'subscription_addon_id' => $addon->id,
        'check_in_at' => '2026-07-05 14:00:00',
        'status' => 'completed',
    ]);

    SubscriptionFreeze::query()->create([
        'subscription_id' => $subscription->id,
        'freeze_start' => '2026-07-10',
        'freeze_end' => '2026-07-12',
        'days' => 3,
        'resumed_on' => '2026-07-13',
    ]);

    $this->getJson('/api/v1/reports/member-subscriptions')
        ->assertOk()
        ->assertJsonPath('data.members.0.latest.addons_count', 1)
        ->assertJsonPath('data.members.0.latest.addons_price_total', '1200.00')
        ->assertJsonPath('data.members.0.latest.package_price', '2000.00')
        ->assertJsonPath('data.members.0.latest.package_paid_total', '1300.00')
        ->assertJsonPath('data.members.0.latest.package_balance', '700.00')
        ->assertJsonPath('data.members.0.latest.freeze_days_used', 3)
        ->assertJsonPath('data.members.0.latest.visits_count', 1)
        ->assertJsonPath('data.members.0.latest.addons.0.plan_name', 'PT 10 Sessions')
        ->assertJsonPath('data.members.0.latest.addons.0.coach_name', 'Coach Ali')
        ->assertJsonPath('data.members.0.latest.addons.0.paid_total', '500.00')
        ->assertJsonPath('data.members.0.latest.addons.0.visits_count', 1);
});

test('blocked visits do not count as attendance', function (): void {
    Carbon::setTestNow('2026-07-20 12:00:00');
    actAsReportViewer();

    $member = Member::factory()->create();
    $subscription = Subscription::factory()->create([
        'member_id' => $member->id,
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
    ]);

    MemberVisit::query()->create([
        'member_id' => $member->id,
        'subscription_id' => $subscription->id,
        'check_in_at' => '2026-07-02 09:00:00',
        'status' => 'allowed',
    ]);
    MemberVisit::query()->create([
        'member_id' => $member->id,
        'subscription_id' => $subscription->id,
        'check_in_at' => '2026-07-03 09:00:00',
        'status' => 'blocked',
    ]);

    $this->getJson('/api/v1/reports/member-subscriptions')
        ->assertOk()
        ->assertJsonPath('data.members.0.latest.visits_count', 1);
});

test('an active subscription past its grace window reports as expired', function (): void {
    Carbon::setTestNow('2026-07-20 12:00:00');
    actAsReportViewer();

    $plan = Plan::factory()->create(['access_grace_days' => 0]);
    Subscription::factory()->create([
        'member_id' => Member::factory()->create()->id,
        'plan_id' => $plan->id,
        'status' => 'active',
        'start_date' => '2026-06-01',
        'end_date' => '2026-06-30',
    ]);

    $this->getJson('/api/v1/reports/member-subscriptions?status=expired')
        ->assertOk()
        ->assertJsonPath('data.totals.expired_count', 1)
        ->assertJsonPath('data.members.0.latest.status', 'expired')
        ->assertJsonPath('data.members.0.latest.raw_status', 'active')
        ->assertJsonPath('data.members.0.latest.days_left', null);
});

test('search and plan filters narrow the report rows', function (): void {
    Carbon::setTestNow('2026-07-20 12:00:00');
    actAsReportViewer();

    $goldPlan = Plan::factory()->create(['name' => 'Gold']);
    $silverPlan = Plan::factory()->create(['name' => 'Silver']);

    Subscription::factory()->create([
        'member_id' => Member::factory()->create(['name' => 'Hany Gold', 'phone' => '01111111111'])->id,
        'plan_id' => $goldPlan->id,
    ]);
    Subscription::factory()->create([
        'member_id' => Member::factory()->create(['name' => 'Sara Silver', 'phone' => '01222222222'])->id,
        'plan_id' => $silverPlan->id,
    ]);

    $this->getJson('/api/v1/reports/member-subscriptions?search=Hany')
        ->assertOk()
        ->assertJsonCount(1, 'data.members')
        ->assertJsonPath('data.members.0.member_name', 'Hany Gold');

    $this->getJson("/api/v1/reports/member-subscriptions?plan_id={$silverPlan->id}")
        ->assertOk()
        ->assertJsonCount(1, 'data.members')
        ->assertJsonPath('data.members.0.member_name', 'Sara Silver');
});

test('date range keeps memberships whose period overlaps the window', function (): void {
    Carbon::setTestNow('2026-07-20 12:00:00');
    actAsReportViewer();

    Subscription::factory()->create([
        'member_id' => Member::factory()->create(['name' => 'Overlapping'])->id,
        'start_date' => '2026-06-15',
        'end_date' => '2026-07-15',
    ]);
    Subscription::factory()->create([
        'member_id' => Member::factory()->create(['name' => 'Outside Window'])->id,
        'start_date' => '2026-03-01',
        'end_date' => '2026-03-31',
    ]);

    $this->getJson('/api/v1/reports/member-subscriptions?from=2026-07-01&to=2026-07-31')
        ->assertOk()
        ->assertJsonCount(1, 'data.members')
        ->assertJsonPath('data.members.0.member_name', 'Overlapping');
});

test('activity totals use payment refund and visit dates and default to today', function (): void {
    Carbon::setTestNow('2026-07-20 12:00:00');
    $viewer = actAsReportViewer();

    $member = Member::factory()->create();
    $subscription = Subscription::factory()->create([
        'member_id' => $member->id,
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
        'price_paid' => '1000.00',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '600.00',
        'status' => 'partial',
        'paid_at' => '2026-07-05 10:00:00',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '200.00',
        'status' => 'partial',
        'paid_at' => '2026-07-20 10:00:00',
    ]);

    $addon = SubscriptionAddon::query()->create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => Plan::factory()->create()->id,
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
        'status' => 'active',
        'price_paid' => '300.00',
    ]);
    Payment::factory()->create([
        'payable_type' => SubscriptionAddon::class,
        'payable_id' => $addon->id,
        'amount' => '100.00',
        'status' => 'partial',
        'paid_at' => '2026-07-05 11:00:00',
    ]);
    Payment::factory()->create([
        'payable_type' => SubscriptionAddon::class,
        'payable_id' => $addon->id,
        'amount' => '75.00',
        'status' => 'partial',
        'paid_at' => '2026-07-20 11:00:00',
    ]);

    foreach ([['2026-07-05 12:00:00', '40.00'], ['2026-07-20 12:00:00', '25.00']] as [$refundedAt, $amount]) {
        SubscriptionRefund::query()->create([
            'subscription_id' => $subscription->id,
            'amount' => $amount,
            'method' => 'cash',
            'refunded_at' => $refundedAt,
            'created_by' => $viewer->id,
        ]);
    }
    foreach ([['2026-07-05 13:00:00', '-30.00'], ['2026-07-20 13:00:00', '-15.00']] as [$paidAt, $amount]) {
        Payment::factory()->create([
            'payable_type' => SubscriptionAddon::class,
            'payable_id' => $addon->id,
            'amount' => $amount,
            'status' => Payment::STATUS_REFUNDED,
            'paid_at' => $paidAt,
        ]);
    }

    foreach ([['2026-07-05 14:00:00', 'allowed'], ['2026-07-20 14:00:00', 'allowed'], ['2026-07-20 15:00:00', 'blocked']] as [$checkInAt, $status]) {
        MemberVisit::query()->create([
            'member_id' => $member->id,
            'subscription_id' => $subscription->id,
            'check_in_at' => $checkInAt,
            'status' => $status,
        ]);
    }

    $this->getJson('/api/v1/reports/member-subscriptions')
        ->assertOk()
        ->assertJsonPath('data.totals.total_collected', '275.00')
        ->assertJsonPath('data.totals.total_refunded', '40.00')
        ->assertJsonPath('data.totals.total_visits', 1);

    $this->getJson('/api/v1/reports/member-subscriptions?from=2026-07-01&to=2026-07-20')
        ->assertOk()
        ->assertJsonPath('data.totals.total_collected', '975.00')
        ->assertJsonPath('data.totals.total_refunded', '110.00')
        ->assertJsonPath('data.totals.total_visits', 2);
});

test('member_id returns the full subscription history newest first', function (): void {
    Carbon::setTestNow('2026-07-20 12:00:00');
    actAsReportViewer();

    $member = Member::factory()->create(['name' => 'Member Hesham']);

    $first = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => Plan::factory()->create(['name' => 'Starter'])->id,
        'status' => 'expired',
        'start_date' => '2026-05-01',
        'end_date' => '2026-05-31',
        'price_paid' => '400.00',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $first->id,
        'amount' => '400.00',
        'status' => 'paid',
    ]);

    $second = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => Plan::factory()->create(['name' => 'Gold'])->id,
        'status' => 'active',
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
        'price_paid' => '900.00',
    ]);
    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $second->id,
        'amount' => '900.00',
        'status' => 'paid',
    ]);

    $this->getJson("/api/v1/reports/member-subscriptions?member_id={$member->id}")
        ->assertOk()
        ->assertJsonPath('data.member.name', 'Member Hesham')
        ->assertJsonPath('data.totals.subscriptions_count', 2)
        ->assertJsonPath('data.totals.lifetime_paid', '1300.00')
        ->assertJsonPath('data.history.0.plan_name', 'Gold')
        ->assertJsonPath('data.history.1.plan_name', 'Starter');
});

test('history preloads the latest subscription detail by default', function (): void {
    Carbon::setTestNow('2026-07-20 12:00:00');
    actAsReportViewer();

    $member = Member::factory()->create();

    Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => Plan::factory()->create(['name' => 'Starter'])->id,
        'status' => 'expired',
        'start_date' => '2026-05-01',
        'end_date' => '2026-05-31',
    ]);
    $latest = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => Plan::factory()->create(['name' => 'Gold'])->id,
        'status' => 'active',
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
    ]);

    $this->getJson("/api/v1/reports/member-subscriptions?member_id={$member->id}")
        ->assertOk()
        ->assertJsonPath('data.detail.subscription.id', $latest->id)
        ->assertJsonPath('data.detail.subscription.plan_name', 'Gold');
});

test('subscription_id returns the full check-in log with exact in and out times', function (): void {
    Carbon::setTestNow('2026-07-20 12:00:00');
    actAsReportViewer();

    $recorder = User::factory()->create(['name' => 'Reception Mona']);
    $member = Member::factory()->create();
    $subscription = Subscription::factory()->create([
        'member_id' => $member->id,
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
    ]);

    MemberVisit::query()->create([
        'member_id' => $member->id,
        'subscription_id' => $subscription->id,
        'check_in_at' => '2026-07-05 09:00:00',
        'check_out_at' => '2026-07-05 10:30:00',
        'status' => 'allowed',
        'scan_method' => 'qr',
        'created_by' => $recorder->id,
    ]);
    MemberVisit::query()->create([
        'member_id' => $member->id,
        'subscription_id' => $subscription->id,
        'check_in_at' => '2026-07-09 18:00:00',
        'status' => 'flagged',
        'alert_reason' => 'Outside geofence',
    ]);

    $this->getJson("/api/v1/reports/member-subscriptions?subscription_id={$subscription->id}")
        ->assertOk()
        ->assertJsonCount(2, 'data.detail.visits')
        // Newest first.
        ->assertJsonPath('data.detail.visits.0.status', 'flagged')
        ->assertJsonPath('data.detail.visits.0.is_open', true)
        ->assertJsonPath('data.detail.visits.0.duration_minutes', null)
        ->assertJsonPath('data.detail.visits.0.alert_reason', 'Outside geofence')
        ->assertJsonPath('data.detail.visits.1.duration_minutes', 90)
        ->assertJsonPath('data.detail.visits.1.is_open', false)
        ->assertJsonPath('data.detail.visits.1.scan_method', 'qr')
        ->assertJsonPath('data.detail.visits.1.recorded_by', 'Reception Mona')
        ->assertJsonPath('data.detail.visits.1.counts_as_attendance', true);
});

test('subscription detail merges add-on payments into one ledger', function (): void {
    Carbon::setTestNow('2026-07-20 12:00:00');
    actAsReportViewer();

    $member = Member::factory()->create();
    $subscription = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => Plan::factory()->create(['name' => 'Gold Monthly'])->id,
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
    ]);

    Payment::factory()->create([
        'payable_type' => Subscription::class,
        'payable_id' => $subscription->id,
        'amount' => '800.00',
        'status' => 'paid',
        'paid_at' => '2026-07-01 10:00:00',
    ]);

    $addon = SubscriptionAddon::query()->create([
        'subscription_id' => $subscription->id,
        'member_id' => $member->id,
        'plan_id' => Plan::factory()->create(['name' => 'PT 10 Sessions'])->id,
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-31',
        'status' => 'active',
        'price_paid' => '1200.00',
    ]);
    Payment::factory()->create([
        'payable_type' => SubscriptionAddon::class,
        'payable_id' => $addon->id,
        'amount' => '500.00',
        'status' => 'partial',
        'paid_at' => '2026-07-08 10:00:00',
    ]);

    SubscriptionFreeze::query()->create([
        'subscription_id' => $subscription->id,
        'freeze_start' => '2026-07-10',
        'freeze_end' => '2026-07-12',
        'days' => 3,
    ]);

    $this->getJson("/api/v1/reports/member-subscriptions?subscription_id={$subscription->id}")
        ->assertOk()
        ->assertJsonCount(2, 'data.detail.payments')
        ->assertJsonPath('data.detail.payments.0.target', 'PT 10 Sessions')
        ->assertJsonPath('data.detail.payments.0.is_addon', true)
        ->assertJsonPath('data.detail.payments.0.amount', '500.00')
        ->assertJsonPath('data.detail.payments.1.target', 'Gold Monthly')
        ->assertJsonPath('data.detail.payments.1.is_addon', false)
        ->assertJsonCount(1, 'data.detail.freezes')
        ->assertJsonPath('data.detail.freezes.0.days', 3);
});

test('report rejects an invalid status filter', function (): void {
    actAsReportViewer();

    $this->getJson('/api/v1/reports/member-subscriptions?status=bogus')
        ->assertStatus(422)
        ->assertJsonPath('error.code', 'validation_failed')
        ->assertJsonStructure(['error' => ['details' => ['status']]]);
});

test('guests cannot read the member subscriptions report', function (): void {
    $this->getJson('/api/v1/reports/member-subscriptions')->assertUnauthorized();
});

test('a user without reports permission is forbidden', function (): void {
    Sanctum::actingAs(User::factory()->create());

    $this->getJson('/api/v1/reports/member-subscriptions')->assertForbidden();
});

test('totals cover every subscription in the period, not just each member latest', function (): void {
    Carbon::setTestNow('2026-07-20 12:00:00');
    actAsReportViewer();

    $member = Member::factory()->create(['name' => 'Renewing Member']);
    $plan = Plan::factory()->create(['price' => '500.00']);

    // Three periods for ONE member, all overlapping the report window. Totalling
    // only the newest row hid the first two renewals' money entirely.
    foreach ([['2026-07-01', '2026-07-10'], ['2026-07-11', '2026-07-20'], ['2026-07-21', '2026-07-31']] as $index => [$start, $end]) {
        $subscription = Subscription::factory()->create([
            'member_id' => $member->id,
            'plan_id' => $plan->id,
            'status' => $index === 2 ? 'active' : 'stopped',
            'start_date' => $start,
            'end_date' => $end,
            'price_paid' => '500.00',
        ]);

        Payment::factory()->create([
            'payable_type' => Subscription::class,
            'payable_id' => $subscription->id,
            'amount' => '500.00',
            'status' => 'paid',
            'paid_at' => $start.' 10:00:00',
        ]);
    }

    $response = $this->getJson('/api/v1/reports/member-subscriptions?from=2026-07-01&to=2026-07-31')
        ->assertOk()
        // Still one row per member in the table…
        ->assertJsonPath('data.totals.members_count', 1)
        ->assertJsonCount(1, 'data.members')
        // …but the money and counts span all three periods.
        ->assertJsonPath('data.totals.subscriptions_count', 3)
        ->assertJsonPath('data.totals.total_collected', '1500.00')
        // The newest period starts tomorrow, so it counts as sold-in-advance
        // rather than active — nobody can check in on it today.
        ->assertJsonPath('data.totals.active_count', 0)
        ->assertJsonPath('data.totals.scheduled_count', 1)
        ->assertJsonPath('data.totals.stopped_count', 2);

    expect($response->json('data.members.0.latest.package_paid_total'))->toBe('500.00');
});

test('totals count refunds from every subscription in the period', function (): void {
    Carbon::setTestNow('2026-07-20 12:00:00');
    actAsReportViewer();

    $member = Member::factory()->create();
    $plan = Plan::factory()->create(['price' => '500.00']);

    $older = Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'status' => 'stopped',
        'start_date' => '2026-07-01',
        'end_date' => '2026-07-10',
        'price_paid' => '500.00',
    ]);
    Subscription::factory()->create([
        'member_id' => $member->id,
        'plan_id' => $plan->id,
        'status' => 'active',
        'start_date' => '2026-07-11',
        'end_date' => '2026-07-31',
        'price_paid' => '500.00',
    ]);

    // Refund sits on the OLDER period — invisible while totals read only the newest.
    SubscriptionRefund::create([
        'subscription_id' => $older->id,
        'amount' => '450.00',
        'method' => 'cash',
        'reason' => 'cancelled',
        'refunded_at' => '2026-07-05 10:00:00',
        'created_by' => User::factory()->create()->id,
    ]);

    $this->getJson('/api/v1/reports/member-subscriptions?from=2026-07-01&to=2026-07-31')
        ->assertOk()
        ->assertJsonPath('data.totals.total_refunded', '450.00');
});
