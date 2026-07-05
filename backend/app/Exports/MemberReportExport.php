<?php

namespace App\Exports;

use App\Models\Member;
use App\Models\MemberBooking;
use App\Models\MemberDocument;
use App\Models\MemberNutritionPlan;
use App\Models\MemberProgressEntry;
use App\Models\MemberWorkoutPlan;
use App\Models\Subscription;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithTitle;

class MemberReportExport implements FromArray, ShouldAutoSize, WithTitle
{
    public function __construct(
        private readonly Member $member,
    ) {}

    public function title(): string
    {
        return 'Member Report';
    }

    /**
     * @return array<int, array<int, mixed>>
     */
    public function array(): array
    {
        $this->member->loadMissing(['latestSubscription.plan', 'coach']);

        $progress = MemberProgressEntry::query()
            ->where('member_id', $this->member->id)
            ->orderBy('recorded_on')
            ->get();
        $subscriptions = Subscription::query()
            ->with('plan')
            ->where('member_id', $this->member->id)
            ->orderBy('start_date')
            ->get();
        $workouts = MemberWorkoutPlan::query()
            ->with('coach')
            ->where('member_id', $this->member->id)
            ->latest()
            ->get();
        $nutritionPlans = MemberNutritionPlan::query()
            ->with('coach')
            ->where('member_id', $this->member->id)
            ->latest()
            ->get();
        $bookings = MemberBooking::query()
            ->with('coach')
            ->where('member_id', $this->member->id)
            ->latest('starts_at')
            ->get();
        $documents = MemberDocument::query()
            ->where('member_id', $this->member->id)
            ->latest()
            ->get();
        $visits = $this->member->visits()
            ->latest('check_in_at')
            ->get();

        $rows = [
            ['Member Report'],
            ['Generated at', now()->toDateTimeString()],
            [],
            ['Member'],
            ['ID', $this->member->id],
            ['Name', $this->member->name],
            ['Phone', $this->member->phone],
            ['Join date', $this->member->join_date?->toDateString()],
            ['Status', $this->member->status],
            ['Latest plan', $this->member->latestSubscription?->plan?->name],
            ['Latest expiry', $this->member->latestSubscription?->end_date?->toDateString()],
            [],
            ['Summary'],
            ['Total visits', $visits->count()],
            ['Blocked visits', $visits->where('status', 'blocked')->count()],
            ['Subscriptions', $subscriptions->count()],
            ['Progress records', $progress->count()],
            [],
            ['Progress Since Joining'],
            ['Recorded on', 'Weight kg', 'Body fat %', 'Chest cm', 'Waist cm', 'Hips cm', 'Arms cm', 'Thighs cm', 'Notes'],
        ];

        foreach ($progress as $entry) {
            $rows[] = [
                $entry->recorded_on?->toDateString(),
                $entry->weight_kg,
                $entry->body_fat_percent,
                $entry->chest_cm,
                $entry->waist_cm,
                $entry->hips_cm,
                $entry->arms_cm,
                $entry->thighs_cm,
                $entry->notes,
            ];
        }

        $rows[] = [];
        $rows[] = ['Subscriptions'];
        $rows[] = ['Plan', 'Start date', 'End date', 'Status', 'Price paid'];
        foreach ($subscriptions as $subscription) {
            $rows[] = [
                $subscription->plan?->name,
                $subscription->start_date?->toDateString(),
                $subscription->end_date?->toDateString(),
                $subscription->status,
                $subscription->price_paid,
            ];
        }

        $rows[] = [];
        $rows[] = ['Workout Plans'];
        $rows[] = ['Title', 'Coach', 'Status', 'Starts on', 'Ends on', 'Sessions', 'Notes'];
        foreach ($workouts as $plan) {
            $rows[] = [
                $plan->title,
                $plan->coach?->name,
                $plan->status,
                $plan->starts_on?->toDateString(),
                $plan->ends_on?->toDateString(),
                collect($plan->sessions ?? [])->pluck('title')->join('; '),
                $plan->notes,
            ];
        }

        $rows[] = [];
        $rows[] = ['Nutrition Plans'];
        $rows[] = ['Title', 'Coach', 'Status', 'Calories', 'Protein g', 'Carbs g', 'Fat g', 'Supplements', 'Notes'];
        foreach ($nutritionPlans as $plan) {
            $rows[] = [
                $plan->title,
                $plan->coach?->name,
                $plan->status,
                $plan->daily_calories,
                $plan->protein_grams,
                $plan->carbs_grams,
                $plan->fat_grams,
                $plan->supplements,
                $plan->notes,
            ];
        }

        $rows[] = [];
        $rows[] = ['Bookings'];
        $rows[] = ['Title', 'Type', 'Coach', 'Starts at', 'Ends at', 'Status', 'Notes'];
        foreach ($bookings as $booking) {
            $rows[] = [
                $booking->title,
                $booking->type,
                $booking->coach?->name,
                $booking->starts_at?->toDateTimeString(),
                $booking->ends_at?->toDateTimeString(),
                $booking->status,
                $booking->notes,
            ];
        }

        $rows[] = [];
        $rows[] = ['Documents'];
        $rows[] = ['Title', 'Type', 'Expires on', 'File path', 'Notes'];
        foreach ($documents as $document) {
            $rows[] = [
                $document->title,
                $document->type,
                $document->expires_on?->toDateString(),
                $document->file_path,
                $document->notes,
            ];
        }

        $rows[] = [];
        $rows[] = ['Visits'];
        $rows[] = ['Check in', 'Check out', 'Status', 'Method', 'Alert'];
        foreach ($visits as $visit) {
            $rows[] = [
                $visit->check_in_at?->toDateTimeString(),
                $visit->check_out_at?->toDateTimeString(),
                $visit->status,
                $visit->scan_method,
                $visit->alert_reason,
            ];
        }

        return $rows;
    }
}
