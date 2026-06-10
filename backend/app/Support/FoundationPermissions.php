<?php

namespace App\Support;

/**
 * Authoritative constants for Phase 0 foundation roles and permissions.
 *
 * Why constants instead of magic strings?
 * - Typos in permission names cause silent authz failures.
 * - A single definition here means a rename or addition is a one-place change
 *   and IDEs/static analysis can catch missing references.
 * - Later phases add their own constants following this pattern; they do NOT
 *   add to this class.
 */
final class FoundationPermissions
{
    // -------------------------------------------------------------------------
    // Roles
    // -------------------------------------------------------------------------

    public const ROLE_ADMIN = 'Admin';

    public const ROLE_MANAGER = 'Manager';

    public const ROLE_CASHIER = 'Cashier';

    public const ROLE_CAPTAIN = 'Captain';

    public const ROLE_ACCOUNTANT = 'Accountant';

    /** All foundation roles in seeding order. */
    public const ALL_ROLES = [
        self::ROLE_ADMIN,
        self::ROLE_MANAGER,
        self::ROLE_CASHIER,
        self::ROLE_CAPTAIN,
        self::ROLE_ACCOUNTANT,
    ];

    // -------------------------------------------------------------------------
    // Permissions — Foundation module
    // -------------------------------------------------------------------------

    /**
     * Grants access to the sample protected capability.
     * Assigned to the Admin role in FoundationAccessSeeder.
     */
    public const PERM_ACCESS_SAMPLE = 'foundation.access-sample';

    /** All foundation permissions in seeding order. */
    public const ALL_PERMISSIONS = [
        self::PERM_ACCESS_SAMPLE,
    ];
}
