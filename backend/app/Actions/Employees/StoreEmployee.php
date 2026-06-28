<?php

namespace App\Actions\Employees;

use App\Models\Employee;

final class StoreEmployee
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data): Employee
    {
        return Employee::create([
            'user_id' => $data['user_id'] ?? null,
            'name' => $data['name'],
            'phone' => $data['phone'] ?? null,
            'role' => $data['role'] ?? 'employee',
            'base_salary' => $data['base_salary'] ?? 0.00,
            'commission_rate' => $data['commission_rate'] ?? 0.0000,
            'shift_id' => $data['shift_id'] ?? null,
            'hire_date' => $data['hire_date'] ?? null,
            'status' => $data['status'] ?? 'active',
        ]);
    }
}
