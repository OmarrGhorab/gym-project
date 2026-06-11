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
        return Plan::create($data);
    }
}
