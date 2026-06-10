<?php

namespace App\Actions\Plans;

use App\Models\Plan;

final class TogglePlanActive
{
    /**
     * Flip the is_active flag on the given plan and return the updated model.
     *
     * Receives typed, already-validated inputs — never touches the HTTP request.
     */
    public function handle(Plan $plan): Plan
    {
        $plan->update(['is_active' => ! $plan->is_active]);

        return $plan->fresh();
    }
}
