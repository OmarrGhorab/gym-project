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
        private readonly string $locale = 'en',
    ) {}

    public function title(): string
    {
        return $this->t('member_report');
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
            [$this->t('member_report')],
            [$this->t('generated_at'), now()->toDateTimeString()],
            [],
            [$this->t('member')],
            [$this->t('id'), $this->member->id],
            [$this->t('name'), $this->member->name],
            [$this->t('phone'), $this->member->phone],
            [$this->t('join_date'), $this->member->join_date?->toDateString()],
            [$this->t('status'), $this->label($this->member->status)],
            [$this->t('latest_plan'), $this->member->latestSubscription?->plan?->name],
            [$this->t('latest_expiry'), $this->member->latestSubscription?->end_date?->toDateString()],
            [],
            [$this->t('summary')],
            [$this->t('total_visits'), $visits->count()],
            [$this->t('blocked_visits'), $visits->where('status', 'blocked')->count()],
            [$this->t('subscriptions'), $subscriptions->count()],
            [$this->t('progress_records'), $progress->count()],
            [],
            [$this->t('progress_since_joining')],
            [$this->t('recorded_on'), $this->t('weight_kg'), $this->t('body_fat_percent'), $this->t('chest_cm'), $this->t('waist_cm'), $this->t('hips_cm'), $this->t('arms_cm'), $this->t('thighs_cm'), $this->t('notes')],
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
        $rows[] = [$this->t('subscriptions')];
        $rows[] = [$this->t('plan'), $this->t('start_date'), $this->t('end_date'), $this->t('status'), $this->t('price_paid')];
        foreach ($subscriptions as $subscription) {
            $rows[] = [
                $subscription->plan?->name,
                $subscription->start_date?->toDateString(),
                $subscription->end_date?->toDateString(),
                $this->label($subscription->status),
                $subscription->price_paid,
            ];
        }

        $rows[] = [];
        $rows[] = [$this->t('workout_plans')];
        $rows[] = [$this->t('title'), $this->t('coach'), $this->t('status'), $this->t('starts_on'), $this->t('ends_on'), $this->t('sessions'), $this->t('notes')];
        foreach ($workouts as $plan) {
            $rows[] = [
                $plan->title,
                $plan->coach?->name,
                $this->label($plan->status),
                $plan->starts_on?->toDateString(),
                $plan->ends_on?->toDateString(),
                collect($plan->sessions ?? [])->pluck('title')->join('; '),
                $plan->notes,
            ];
        }

        $rows[] = [];
        $rows[] = [$this->t('nutrition_plans')];
        $rows[] = [$this->t('title'), $this->t('coach'), $this->t('status'), $this->t('calories'), $this->t('protein_g'), $this->t('carbs_g'), $this->t('fat_g'), $this->t('supplements'), $this->t('notes')];
        foreach ($nutritionPlans as $plan) {
            $rows[] = [
                $plan->title,
                $plan->coach?->name,
                $this->label($plan->status),
                $plan->daily_calories,
                $plan->protein_grams,
                $plan->carbs_grams,
                $plan->fat_grams,
                $plan->supplements,
                $plan->notes,
            ];
        }

        $rows[] = [];
        $rows[] = [$this->t('bookings')];
        $rows[] = [$this->t('title'), $this->t('type'), $this->t('coach'), $this->t('starts_at'), $this->t('ends_at'), $this->t('status'), $this->t('notes')];
        foreach ($bookings as $booking) {
            $rows[] = [
                $booking->title,
                $booking->type,
                $booking->coach?->name,
                $booking->starts_at?->toDateTimeString(),
                $booking->ends_at?->toDateTimeString(),
                $this->label($booking->status),
                $booking->notes,
            ];
        }

        $rows[] = [];
        $rows[] = [$this->t('documents')];
        $rows[] = [$this->t('title'), $this->t('type'), $this->t('expires_on'), $this->t('file_path'), $this->t('notes')];
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
        $rows[] = [$this->t('visits')];
        $rows[] = [$this->t('check_in'), $this->t('check_out'), $this->t('status'), $this->t('method'), $this->t('alert')];
        foreach ($visits as $visit) {
            $rows[] = [
                $visit->check_in_at?->toDateTimeString(),
                $visit->check_out_at?->toDateTimeString(),
                $this->label($visit->status),
                $this->label($visit->scan_method),
                $visit->alert_reason,
            ];
        }

        return $rows;
    }

    private function t(string $key): string
    {
        return $this->translations()[$key] ?? $key;
    }

    private function label(?string $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        return $this->translations()[$value] ?? str_replace('_', ' ', ucfirst($value));
    }

    /**
     * @return array<string, string>
     */
    private function translations(): array
    {
        if ($this->locale === 'ar') {
            return [
                'member_report' => 'تقرير العضو',
                'generated_at' => 'تاريخ الإنشاء',
                'member' => 'العضو',
                'id' => 'المعرف',
                'name' => 'الاسم',
                'phone' => 'الهاتف',
                'join_date' => 'تاريخ الانضمام',
                'status' => 'الحالة',
                'latest_plan' => 'آخر خطة',
                'latest_expiry' => 'آخر تاريخ انتهاء',
                'summary' => 'الملخص',
                'total_visits' => 'إجمالي الزيارات',
                'blocked_visits' => 'الزيارات المرفوضة',
                'subscriptions' => 'الاشتراكات',
                'progress_records' => 'سجلات التقدم',
                'progress_since_joining' => 'التقدم منذ الانضمام',
                'recorded_on' => 'تاريخ التسجيل',
                'weight_kg' => 'الوزن كجم',
                'body_fat_percent' => 'نسبة الدهون %',
                'chest_cm' => 'الصدر سم',
                'waist_cm' => 'الوسط سم',
                'hips_cm' => 'الحوض سم',
                'arms_cm' => 'الذراع سم',
                'thighs_cm' => 'الفخذ سم',
                'notes' => 'ملاحظات',
                'plan' => 'الخطة',
                'start_date' => 'تاريخ البداية',
                'end_date' => 'تاريخ النهاية',
                'price_paid' => 'المبلغ المدفوع',
                'workout_plans' => 'خطط التمرين',
                'title' => 'العنوان',
                'coach' => 'المدرب',
                'starts_on' => 'يبدأ في',
                'ends_on' => 'ينتهي في',
                'sessions' => 'الجلسات',
                'nutrition_plans' => 'خطط التغذية',
                'calories' => 'السعرات',
                'protein_g' => 'البروتين جم',
                'carbs_g' => 'الكارب جم',
                'fat_g' => 'الدهون جم',
                'supplements' => 'المكملات',
                'bookings' => 'الحجوزات',
                'type' => 'النوع',
                'starts_at' => 'يبدأ في',
                'ends_at' => 'ينتهي في',
                'documents' => 'المستندات',
                'expires_on' => 'ينتهي في',
                'file_path' => 'مسار الملف',
                'visits' => 'الزيارات',
                'check_in' => 'الدخول',
                'check_out' => 'الخروج',
                'method' => 'الطريقة',
                'alert' => 'التنبيه',
                'active' => 'نشط',
                'blocked' => 'مرفوض',
                'completed' => 'مكتمل',
                'pending' => 'معلق',
                'cancelled' => 'ملغي',
                'cash' => 'نقدي',
                'card' => 'بطاقة',
                'bank_transfer' => 'تحويل بنكي',
            ];
        }

        return [
            'member_report' => 'Member Report',
            'generated_at' => 'Generated at',
            'member' => 'Member',
            'id' => 'ID',
            'name' => 'Name',
            'phone' => 'Phone',
            'join_date' => 'Join date',
            'status' => 'Status',
            'latest_plan' => 'Latest plan',
            'latest_expiry' => 'Latest expiry',
            'summary' => 'Summary',
            'total_visits' => 'Total visits',
            'blocked_visits' => 'Blocked visits',
            'subscriptions' => 'Subscriptions',
            'progress_records' => 'Progress records',
            'progress_since_joining' => 'Progress Since Joining',
            'recorded_on' => 'Recorded on',
            'weight_kg' => 'Weight kg',
            'body_fat_percent' => 'Body fat %',
            'chest_cm' => 'Chest cm',
            'waist_cm' => 'Waist cm',
            'hips_cm' => 'Hips cm',
            'arms_cm' => 'Arms cm',
            'thighs_cm' => 'Thighs cm',
            'notes' => 'Notes',
            'plan' => 'Plan',
            'start_date' => 'Start date',
            'end_date' => 'End date',
            'price_paid' => 'Price paid',
            'workout_plans' => 'Workout Plans',
            'title' => 'Title',
            'coach' => 'Coach',
            'starts_on' => 'Starts on',
            'ends_on' => 'Ends on',
            'sessions' => 'Sessions',
            'nutrition_plans' => 'Nutrition Plans',
            'calories' => 'Calories',
            'protein_g' => 'Protein g',
            'carbs_g' => 'Carbs g',
            'fat_g' => 'Fat g',
            'supplements' => 'Supplements',
            'bookings' => 'Bookings',
            'type' => 'Type',
            'starts_at' => 'Starts at',
            'ends_at' => 'Ends at',
            'documents' => 'Documents',
            'expires_on' => 'Expires on',
            'file_path' => 'File path',
            'visits' => 'Visits',
            'check_in' => 'Check in',
            'check_out' => 'Check out',
            'method' => 'Method',
            'alert' => 'Alert',
        ];
    }
}
