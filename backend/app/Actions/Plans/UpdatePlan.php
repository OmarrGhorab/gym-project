<?php

namespace App\Actions\Plans;

use App\Models\Plan;

final class UpdatePlan
{
    /**
     * Update an existing plan with validated data.
     *
     * Receives typed, already-validated inputs — never touches the HTTP request.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(Plan $plan, array $data): Plan
    {
        $data = $this->normalize($data);

        $plan->update($data);

        return $plan->fresh();
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function normalize(array $data): array
    {
        $data['is_unlimited_sessions'] = (bool) ($data['is_unlimited_sessions'] ?? false);

        if ($data['is_unlimited_sessions']) {
            $data['sessions_count'] = null;
        }

        return $data;
    }
}
