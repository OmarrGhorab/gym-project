<?php

namespace App\Actions\Auth;

use App\Models\User;
use Illuminate\Support\Facades\Hash;

final class ChangeUserPassword
{
    public function handle(User $user, string $password): void
    {
        $user->forceFill([
            'password' => Hash::make($password),
        ])->save();

        activity()
            ->causedBy($user)
            ->log('Changed own password');
    }
}
