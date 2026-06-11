<?php

namespace App\Support;

/**
 * Authoritative constants for Phase 4 cross-cutting capabilities and exports.
 */
final class SystemPermissions
{
    public const PERM_ROLES_MANAGE = 'roles.manage';

    public const PERM_SETTINGS_MANAGE = 'settings.manage';

    public const PERM_AUDIT_VIEW = 'audit.view';

    public const PERM_EXPORT_MEMBERS = 'export.members';

    public const PERM_EXPORT_SUBSCRIPTIONS = 'export.subscriptions';

    public const PERM_EXPORT_SALES = 'export.sales';

    public const PERM_EXPORT_PAYMENTS = 'export.payments';

    public const PERM_EXPORT_PAYROLL = 'export.payroll';

    public const PERM_EXPORT_REPORTS = 'export.reports';

    public const ALL_PERMISSIONS = [
        self::PERM_ROLES_MANAGE,
        self::PERM_SETTINGS_MANAGE,
        self::PERM_AUDIT_VIEW,
        self::PERM_EXPORT_MEMBERS,
        self::PERM_EXPORT_SUBSCRIPTIONS,
        self::PERM_EXPORT_SALES,
        self::PERM_EXPORT_PAYMENTS,
        self::PERM_EXPORT_PAYROLL,
        self::PERM_EXPORT_REPORTS,
    ];

    /**
     * Map of resource identifier to its corresponding export permission.
     */
    public const EXPORT_PERMISSION_MAP = [
        'members' => self::PERM_EXPORT_MEMBERS,
        'subscriptions' => self::PERM_EXPORT_SUBSCRIPTIONS,
        'sales' => self::PERM_EXPORT_SALES,
        'payments' => self::PERM_EXPORT_PAYMENTS,
        'payroll' => self::PERM_EXPORT_PAYROLL,
        'reports' => self::PERM_EXPORT_REPORTS,
    ];

    /**
     * Map of resource identifier to its existing view permission.
     * Export permission will be granted to roles that have the view permission.
     */
    public const EXPORT_VIEW_PERMISSION_MAP = [
        'members' => 'members.view',
        'subscriptions' => 'subscriptions.view',
        'sales' => 'sales.view',
        'payments' => 'payments.view',
        'payroll' => 'payroll.view',
        'reports' => 'reports.view',
    ];
}
