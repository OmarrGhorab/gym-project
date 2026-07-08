<?php

namespace Database\Seeders;

use App\Models\Employee;
use App\Models\Member;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class MemberSeeder extends Seeder
{
    private const MEMBER_COUNT = 100;

    public function run(): void
    {
        $creatorId = User::query()->where('email', 'operations.manager@gym.test')->value('id');
        $coachIds = Employee::query()
            ->whereIn('role', ['coach', 'captain'])
            ->orderBy('id')
            ->pluck('id')
            ->values();

        foreach (range(1, self::MEMBER_COUNT) as $index) {
            $member = $this->memberRecord($index, $creatorId, $coachIds->all());

            Member::query()->updateOrCreate(
                ['phone' => $member['phone']],
                $member,
            );
        }
    }

    /**
     * @param  list<int>  $coachIds
     * @return array<string, mixed>
     */
    private function memberRecord(int $index, ?int $creatorId, array $coachIds): array
    {
        $isArabicName = $index <= 50;
        $joinDate = Carbon::today()->subDays(($index * 3) % 180);
        $birthDate = Carbon::today()->subYears(18 + ($index % 23))->subDays($index);
        $email = $index % 4 === 0 ? null : sprintf('member.%03d@gym.test', $index);
        $coachId = $coachIds === []
            ? null
            : $coachIds[($index - 1) % count($coachIds)];

        return [
            'name' => $isArabicName ? $this->arabicName($index) : $this->englishName($index),
            'phone' => '+2012'.str_pad((string) (7000000 + $index), 7, '0', STR_PAD_LEFT),
            'email' => $email,
            'gender' => $index % 2 === 0 ? 'female' : 'male',
            'birth_date' => $birthDate->toDateString(),
            'national_id' => (string) (30000000000000 + $index),
            'emergency_contact_name' => $isArabicName
                ? 'جهة اتصال '.$this->arabicName($index + 7)
                : 'Emergency '.$this->englishName($index + 7),
            'emergency_contact_phone' => '+2015'.str_pad((string) (8000000 + $index), 7, '0', STR_PAD_LEFT),
            'join_date' => $joinDate->toDateString(),
            'status' => 'active',
            'notes' => $isArabicName ? 'عضو بدون اشتراك حالي.' : 'Member without an active subscription.',
            'goals' => $this->goalFor($index, $isArabicName),
            'injuries' => $index % 9 === 0 ? ($isArabicName ? 'إصابة كتف قديمة' : 'Old shoulder strain') : null,
            'medical_notes' => $index % 11 === 0 ? ($isArabicName ? 'يحتاج متابعة بسيطة أثناء التمرين.' : 'Needs light monitoring during workouts.') : null,
            'tags' => $isArabicName ? ['arabic-profile', 'no-subscription'] : ['english-profile', 'no-subscription'],
            'coach_id' => $coachId,
            'created_by' => $creatorId,
        ];
    }

    private function arabicName(int $index): string
    {
        $firstNames = ['أحمد', 'محمد', 'محمود', 'علي', 'عمر', 'يوسف', 'مصطفى', 'عبدالله', 'سارة', 'مريم', 'نور', 'منة', 'هبة', 'آية', 'رحمة'];
        $lastNames = ['الشافعي', 'السيد', 'حسن', 'عبدالرحمن', 'فؤاد', 'إبراهيم', 'محمود', 'خليل', 'طارق', 'صبري'];

        return $firstNames[($index - 1) % count($firstNames)].' '.$lastNames[($index - 1) % count($lastNames)];
    }

    private function englishName(int $index): string
    {
        $firstNames = ['Adam', 'Omar', 'Youssef', 'Karim', 'Lina', 'Maya', 'Nour', 'Sara', 'Layla', 'Jana', 'Ziad', 'Tamer', 'Hana', 'Malak', 'Rania'];
        $lastNames = ['Hassan', 'Mostafa', 'Nabil', 'Farouk', 'Samir', 'Kamal', 'Adel', 'Fathy', 'Emad', 'Ragab'];

        return $firstNames[($index - 1) % count($firstNames)].' '.$lastNames[($index - 1) % count($lastNames)];
    }

    private function goalFor(int $index, bool $isArabicName): string
    {
        $arabicGoals = ['خفض الوزن', 'زيادة الكتلة العضلية', 'تحسين اللياقة', 'الالتزام اليومي'];
        $englishGoals = ['weight loss', 'muscle gain', 'general fitness', 'routine consistency'];
        $goals = $isArabicName ? $arabicGoals : $englishGoals;

        return $goals[($index - 1) % count($goals)];
    }
}
