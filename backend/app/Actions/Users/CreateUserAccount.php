<?php

namespace App\Actions\Users;

use App\Models\Employee;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

final class CreateUserAccount
{
    /**
     * @param  array{
     *     name: string,
     *     email: string,
     *     password: string,
     *     roles: list<string>,
     *     employee_id?: int|null
     * }  $data
     */
    public function handle(array $data): User
    {
        return DB::transaction(function () use ($data): User {
            $employee = null;

            if (! empty($data['employee_id'])) {
                $employee = Employee::query()
                    ->whereKey($data['employee_id'])
                    ->whereNull('user_id')
                    ->lockForUpdate()
                    ->first();

                if (! $employee) {
                    throw ValidationException::withMessages([
                        'employee_id' => ['The selected employee is already linked or unavailable.'],
                    ]);
                }
            }

            $user = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
            ]);

            $user->forceFill(['email_verified_at' => now()])->save();
            $user->syncRoles($data['roles']);

            if ($employee) {
                $employee->update(['user_id' => $user->id]);
            }

            return $user->load('roles');
        });
    }
}
