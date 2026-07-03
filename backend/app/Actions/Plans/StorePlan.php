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

        return Plan::create($data);
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
