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
        $plan->update($data);

        return $plan->fresh();
    }
}
