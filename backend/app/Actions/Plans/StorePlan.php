<?php

namespace App\Actions\Plans;

use App\Models\Plan;

final class StorePlan
{
    /**
     * Create and persist a new plan from validated data.
     *
     * Receives typed, already-validated inputs — never touches the HTTP request.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data): Plan
    {
        $data = $this->normalize($data);
        $packageAddons = $data['package_addons'] ?? [];
        unset($data['package_addons']);

        $plan = Plan::create($data);
        $this->syncPackageAddons($plan, $packageAddons);

        return $plan->fresh(['packageItems.includedPlan', 'packageItems.coach']) ?? $plan;
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalize(array $data): array
    {
        $data['is_unlimited_sessions'] = (bool) ($data['is_unlimited_sessions'] ?? false);
        $data['max_freeze_days'] = (int) ($data['max_freeze_days'] ?? 0);
        $data['access_grace_days'] = (int) ($data['access_grace_days'] ?? 0);
        $data['cancellation_grace_days'] = (int) ($data['cancellation_grace_days'] ?? 2);
        $data['min_freeze_days'] = (int) ($data['min_freeze_days'] ?? 0);
        $data['freeze_requires_approval'] = (bool) ($data['freeze_requires_approval'] ?? false);

        if ($data['is_unlimited_sessions']) {
            $data['sessions_count'] = null;
        }

        return $data;
    }

    /** @param array<int, array{plan_id: int, coach_id: int}> $items */
    private function syncPackageAddons(Plan $plan, array $items): void
    {
        if ($plan->type !== 'offer_package') {
            return;
        }

        $plan->packageItems()->createMany(array_map(
            fn (array $item): array => ['included_plan_id' => $item['plan_id'], 'coach_id' => $item['coach_id']],
            $items,
        ));
    }
}
