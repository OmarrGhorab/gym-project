<?php

namespace App\Support;

use App\Models\ShiftSession;
use App\Models\User;

/**
 * Who may see which shift's money.
 *
 * A shift is one employee's account of what they took in. The next employee on
 * the desk is answerable for their own takings and nothing else, so they are not
 * shown what the shift before them collected, what it left in the drawer, or how
 * its count came out. That is between that employee and an admin.
 *
 * The cash itself does still carry across shifts — it physically stays in the
 * drawer — so the float is never removed from the arithmetic, only from what the
 * staff view renders. An admin reviewing the handover sees the whole drawer.
 */
final class ShiftDrawerAccess
{
    /** Every shift's money, for whoever has to reconcile them against each other. */
    public const SCOPE_FULL = 'full';

    /** Only what this employee collected on this shift. No float, no previous shift. */
    public const SCOPE_OWN = 'own';

    /** Somebody else's shift: that it exists and who is on it, and nothing about the money. */
    public const SCOPE_NONE = 'none';

    public static function seesEveryShift(?User $user): bool
    {
        return (bool) $user?->hasRole(FoundationPermissions::ROLE_ADMIN);
    }

    public static function scopeFor(?User $user, ShiftSession $session): string
    {
        if (self::seesEveryShift($user)) {
            return self::SCOPE_FULL;
        }

        return self::isOnDuty($user, $session) ? self::SCOPE_OWN : self::SCOPE_NONE;
    }

    /**
     * Whether the session is this user's own.
     *
     * Matched on the employee as well as the user because an admin can open a
     * shift on somebody else's behalf: the drawer belongs to the employee named
     * on it, not to whoever pressed the button.
     */
    public static function isOnDuty(?User $user, ShiftSession $session): bool
    {
        if (! $user) {
            return false;
        }

        if ($session->opened_by === $user->id || $session->closed_by === $user->id) {
            return true;
        }

        $employeeId = $user->employee?->id;

        return $employeeId !== null && in_array(
            $employeeId,
            [$session->opened_by_employee_id, $session->closed_by_employee_id],
            true,
        );
    }
}
