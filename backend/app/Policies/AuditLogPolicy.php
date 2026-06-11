<?php

namespace App\Policies;

use App\Models\User;
use App\Support\SystemPermissions;

class AuditLogPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermissionTo(SystemPermissions::PERM_AUDIT_VIEW);
    }
}
