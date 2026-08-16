<?php

namespace App\Support;

/**
 * Aggregates all permissions across the system modules.
 */
final class PermissionMatrix
{
    /**
     * Get a flat array of all permissions in the system.
     */
    public static function all(): array
    {
        return array_values(array_unique(array_merge(
            FoundationPermissions::ALL_PERMISSIONS,
            MembershipPermissions::ALL_PERMISSIONS,
            PosPermissions::ALL_PERMISSIONS,
            HrFinancePermissions::ALL_PERMISSIONS,
            SystemPermissions::ALL_PERMISSIONS,
            MoneyPermissions::ALL_PERMISSIONS
        )));
    }

    /**
     * Get all permissions grouped by their module prefix.
     * Permissions in SystemPermissions are grouped under 'system'.
     * Other permissions are grouped by the segment before the first dot.
     */
    public static function grouped(): array
    {
        $grouped = [];

        foreach (self::all() as $permission) {
            if (in_array($permission, SystemPermissions::ALL_PERMISSIONS, true)) {
                $grouped['system'][] = $permission;
            } else {
                $parts = explode('.', $permission);
                $prefix = $parts[0] ?? 'general';
                $grouped[$prefix][] = $permission;
            }
        }

        return $grouped;
    }
}
