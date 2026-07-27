<?php

namespace App\Support;

/**
 * Authoritative constants for Phase 1 membership-module roles and permissions.
 *
 * Why constants instead of magic strings?
 * - Typos in permission names cause silent authz failures.
 * - A single definition here means a rename or addition is a one-place change
 *   and IDEs/static analysis can catch missing references.
 * - This class mirrors the pattern established by FoundationPermissions and
 *   adds only the permissions introduced in Phase 1 (Members, Subscriptions &
 *   Plans).  It does NOT modify FoundationPermissions.
 *
 * Roles themselves are defined in FoundationPermissions::ROLE_* constants and
 * referenced here by importing that class; this avoids duplicating role names.
 */
final class MembershipPermissions
{
    // -------------------------------------------------------------------------
    // Permissions — Members module
    // -------------------------------------------------------------------------

    public const PERM_MEMBERS_VIEW = 'members.view';

    public const PERM_MEMBERS_CREATE = 'members.create';

    public const PERM_MEMBERS_UPDATE = 'members.update';

    public const PERM_MEMBERS_DELETE = 'members.delete';

    // -------------------------------------------------------------------------
    // Permissions — Plans module
    // -------------------------------------------------------------------------

    public const PERM_PLANS_VIEW = 'plans.view';

    public const PERM_PLANS_CREATE = 'plans.create';

    public const PERM_PLANS_UPDATE = 'plans.update';

    public const PERM_PLANS_DELETE = 'plans.delete';

    // -------------------------------------------------------------------------
    // Permissions — Subscriptions module
    // -------------------------------------------------------------------------

    public const PERM_SUBSCRIPTIONS_VIEW = 'subscriptions.view';

    public const PERM_SUBSCRIPTIONS_CREATE = 'subscriptions.create';

    public const PERM_SUBSCRIPTIONS_RENEW = 'subscriptions.renew';

    public const PERM_SUBSCRIPTIONS_UPGRADE = 'subscriptions.upgrade';

    public const PERM_SUBSCRIPTIONS_FREEZE = 'subscriptions.freeze';

    public const PERM_SUBSCRIPTIONS_STOP = 'subscriptions.stop';

    /** Allow a refund after the plan cancellation grace period. */
    public const PERM_SUBSCRIPTIONS_FORCE_REFUND = 'subscriptions.force_refund';

    // -------------------------------------------------------------------------
    // Permissions — Payments module
    // -------------------------------------------------------------------------

    public const PERM_PAYMENTS_VIEW = 'payments.view';

    public const PERM_PAYMENTS_CREATE = 'payments.create';

    // -------------------------------------------------------------------------
    // Permissions — Notifications module
    // -------------------------------------------------------------------------

    public const PERM_NOTIFICATIONS_VIEW = 'notifications.view';

    // -------------------------------------------------------------------------
    // Permissions — Dashboard module
    // -------------------------------------------------------------------------

    public const PERM_DASHBOARD_VIEW = 'dashboard.view';

    // -------------------------------------------------------------------------
    // All membership permissions in seeding order
    // -------------------------------------------------------------------------

    /** All Phase 1 membership permissions in seeding order. */
    public const ALL_PERMISSIONS = [
        // Members
        self::PERM_MEMBERS_VIEW,
        self::PERM_MEMBERS_CREATE,
        self::PERM_MEMBERS_UPDATE,
        self::PERM_MEMBERS_DELETE,
        // Plans
        self::PERM_PLANS_VIEW,
        self::PERM_PLANS_CREATE,
        self::PERM_PLANS_UPDATE,
        self::PERM_PLANS_DELETE,
        // Subscriptions
        self::PERM_SUBSCRIPTIONS_VIEW,
        self::PERM_SUBSCRIPTIONS_CREATE,
        self::PERM_SUBSCRIPTIONS_RENEW,
        self::PERM_SUBSCRIPTIONS_UPGRADE,
        self::PERM_SUBSCRIPTIONS_FREEZE,
        self::PERM_SUBSCRIPTIONS_STOP,
        self::PERM_SUBSCRIPTIONS_FORCE_REFUND,
        // Payments
        self::PERM_PAYMENTS_VIEW,
        self::PERM_PAYMENTS_CREATE,
        // Notifications
        self::PERM_NOTIFICATIONS_VIEW,
        // Dashboard
        self::PERM_DASHBOARD_VIEW,
    ];
}
