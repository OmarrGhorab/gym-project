<?php

namespace Database\Seeders;

use App\Models\Employee;
use App\Models\Member;
use App\Models\MemberBooking;
use App\Models\MemberDocument;
use App\Models\MemberNutritionPlan;
use App\Models\MemberProgressEntry;
use App\Models\MemberVisit;
use App\Models\MemberWorkoutPlan;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

class MemberReportDemoSeeder extends Seeder
{
    public function run(): void
    {
        $creatorId = User::query()->orderBy('id')->value('id');
        $coaches = Employee::query()
            ->where('status', 'active')
            ->orderBy('id')
            ->get(['id', 'name', 'role']);

        $members = Member::query()
            ->with(['latestSubscription.plan'])
            ->whereHas('subscriptions')
            ->orderBy('id')
            ->get();

        foreach ($members as $index => $member) {
            $coach = $coaches->isNotEmpty() ? $coaches[$index % $coaches->count()] : null;
            $latestSubscription = $member->latestSubscription;
            $joinDate = $member->join_date ?? Carbon::today()->subMonths(3);
            $anchorDate = Carbon::parse($latestSubscription?->start_date ?? $joinDate)->startOfDay();

            if (! $member->progressEntries()->exists()) {
                $this->seedProgress($member, $creatorId, $anchorDate);
            }

            if (! $member->workoutPlans()->exists()) {
                $this->seedWorkoutPlan($member, $coach?->id, $creatorId, $anchorDate);
            }

            if (! $member->nutritionPlans()->exists()) {
                $this->seedNutritionPlan($member, $coach?->id, $creatorId);
            }

            if (! $member->bookings()->exists()) {
                $this->seedBooking($member, $coach?->id, $creatorId, $anchorDate);
            }

            if (! $member->documents()->exists()) {
                $this->seedDocument($member, $creatorId);
            }

            if (! $member->visits()->exists()) {
                $this->seedVisits($member, $latestSubscription?->id, $creatorId, $anchorDate);
            }
        }
    }

    private function seedProgress(Member $member, ?int $creatorId, Carbon $anchorDate): void
    {
        $entries = [
            [
                'recorded_on' => $anchorDate->copy()->subDays(28),
                'weight_kg' => 94.50,
                'body_fat_percent' => 27.40,
                'chest_cm' => 108.00,
                'waist_cm' => 101.00,
                'hips_cm' => 106.00,
                'arms_cm' => 36.00,
                'thighs_cm' => 61.00,
                'notes' => 'Initial assessment recorded at the start of the member program.',
            ],
            [
                'recorded_on' => $anchorDate->copy()->subDays(14),
                'weight_kg' => 92.80,
                'body_fat_percent' => 26.20,
                'chest_cm' => 107.00,
                'waist_cm' => 98.50,
                'hips_cm' => 104.50,
                'arms_cm' => 36.40,
                'thighs_cm' => 60.50,
                'notes' => 'Good adherence to cardio sessions and nutrition plan.',
            ],
            [
                'recorded_on' => $anchorDate->copy()->subDays(2),
                'weight_kg' => 91.30,
                'body_fat_percent' => 25.40,
                'chest_cm' => 106.50,
                'waist_cm' => 96.80,
                'hips_cm' => 103.00,
                'arms_cm' => 36.80,
                'thighs_cm' => 60.00,
                'notes' => 'Latest checkpoint shows steady progress and improved recovery.',
            ],
        ];

        foreach ($entries as $entry) {
            MemberProgressEntry::query()->create([
                'member_id' => $member->id,
                'created_by' => $creatorId,
                ...$entry,
            ]);
        }
    }

    private function seedWorkoutPlan(Member $member, ?int $coachId, ?int $creatorId, Carbon $anchorDate): void
    {
        MemberWorkoutPlan::query()->create([
            'member_id' => $member->id,
            'coach_id' => $coachId,
            'title' => 'Strength and Fat Loss Split',
            'status' => 'active',
            'starts_on' => $anchorDate->copy()->subDays(10)->toDateString(),
            'ends_on' => $anchorDate->copy()->addDays(35)->toDateString(),
            'sessions' => [
                ['title' => 'Upper body push + treadmill intervals'],
                ['title' => 'Lower body strength + core'],
                ['title' => 'Full body circuit + rower finish'],
            ],
            'notes' => 'Three coached sessions per week with one recovery day between heavy lifts.',
            'created_by' => $creatorId,
        ]);
    }

    private function seedNutritionPlan(Member $member, ?int $coachId, ?int $creatorId): void
    {
        MemberNutritionPlan::query()->create([
            'member_id' => $member->id,
            'coach_id' => $coachId,
            'title' => 'High Protein Recomposition Plan',
            'status' => 'active',
            'daily_calories' => 2200,
            'protein_grams' => 180,
            'carbs_grams' => 190,
            'fat_grams' => 70,
            'supplements' => 'Whey isolate, omega-3, magnesium',
            'notes' => 'Split meals across 4 feedings and keep hydration above 3 liters daily.',
            'created_by' => $creatorId,
        ]);
    }

    private function seedBooking(Member $member, ?int $coachId, ?int $creatorId, Carbon $anchorDate): void
    {
        MemberBooking::query()->create([
            'member_id' => $member->id,
            'coach_id' => $coachId,
            'title' => 'Weekly PT Review',
            'type' => 'pt_session',
            'starts_at' => $anchorDate->copy()->addDays(3)->setTime(18, 0),
            'ends_at' => $anchorDate->copy()->addDays(3)->setTime(19, 0),
            'status' => 'scheduled',
            'notes' => 'Review lifting form, update cardio target, and retest mobility checkpoints.',
            'created_by' => $creatorId,
        ]);
    }

    private function seedDocument(Member $member, ?int $creatorId): void
    {
        MemberDocument::query()->create([
            'member_id' => $member->id,
            'type' => 'assessment',
            'title' => 'Initial Assessment Summary',
            'file_path' => "members/documents/{$member->id}/initial-assessment-summary.pdf",
            'expires_on' => Carbon::today()->addYear()->toDateString(),
            'notes' => 'Baseline measurements, movement screen, and approval form uploaded for review.',
            'created_by' => $creatorId,
        ]);
    }

    private function seedVisits(Member $member, ?int $subscriptionId, ?int $creatorId, Carbon $anchorDate): void
    {
        foreach ([21, 16, 11, 6, 2] as $daysAgo) {
            $checkIn = $anchorDate->copy()->subDays($daysAgo)->setTime(18, 5);

            MemberVisit::query()->create([
                'member_id' => $member->id,
                'subscription_id' => $subscriptionId,
                'check_in_at' => $checkIn,
                'check_out_at' => $checkIn->copy()->addMinutes(82),
                'status' => 'allowed',
                'scan_method' => 'qr',
                'check_in_location_status' => 'inside',
                'check_out_location_status' => 'inside',
                'alert_reason' => null,
                'notes' => 'Demo seeded visit for member performance reporting.',
                'created_by' => $creatorId,
            ]);
        }
    }
}
