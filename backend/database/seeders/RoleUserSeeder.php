<?php

namespace Database\Seeders;

use App\Models\User;
use App\Support\FoundationPermissions;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Role;

class RoleUserSeeder extends Seeder
{
    /**
     * Seed one stable login user for each preset role.
     */
    public function run(): void
    {
        foreach (FoundationPermissions::ALL_ROLES as $roleName) {
            Role::findByName($roleName, 'web');

            $user = User::updateOrCreate(
                ['email' => $this->emailForRole($roleName)],
                [
                    'name' => "{$roleName} User",
                    'password' => Hash::make('password'),
                ],
            );

            if ($user->email_verified_at === null) {
                $user->forceFill(['email_verified_at' => now()])->save();
            }

            $user->syncRoles([$roleName]);
        }
    }

    private function emailForRole(string $roleName): string
    {
        return strtolower($roleName).'@gym.test';
    }
}
