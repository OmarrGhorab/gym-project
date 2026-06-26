<?php

namespace App\Support;

/**
 * Authoritative constants for Phase 3 HR and Finance module permissions.
 */
final class HrFinancePermissions
{
    public const PERM_EMPLOYEES_VIEW = 'employees.view';

    public const PERM_EMPLOYEES_CREATE = 'employees.create';

    public const PERM_EMPLOYEES_UPDATE = 'employees.update';

    public const PERM_EMPLOYEES_DELETE = 'employees.delete';

    public const PERM_COMMISSIONS_VIEW = 'commissions.view';

    public const PERM_COMMISSIONS_BACKFILL = 'commissions.backfill';

    public const PERM_PAYROLL_VIEW = 'payroll.view';

    public const PERM_PAYROLL_GENERATE = 'payroll.generate';

    public const PERM_PAYROLL_PAY = 'payroll.pay';

    public const PERM_EXPENSES_VIEW = 'expenses.view';

    public const PERM_EXPENSES_CREATE = 'expenses.create';

    public const PERM_EXPENSES_UPDATE = 'expenses.update';

    public const PERM_EXPENSES_DELETE = 'expenses.delete';

    public const PERM_ATTENDANCE_VIEW = 'attendance.view';

    public const PERM_ATTENDANCE_CREATE = 'attendance.create';

    public const PERM_ATTENDANCE_UPDATE = 'attendance.update';

    public const PERM_ATTENDANCE_DELETE = 'attendance.delete';

    /** All Phase 3 HR and Finance permissions in seeding order. */
    public const ALL_PERMISSIONS = [
        self::PERM_EMPLOYEES_VIEW,
        self::PERM_EMPLOYEES_CREATE,
        self::PERM_EMPLOYEES_UPDATE,
        self::PERM_EMPLOYEES_DELETE,
        self::PERM_COMMISSIONS_VIEW,
        self::PERM_COMMISSIONS_BACKFILL,
        self::PERM_PAYROLL_VIEW,
        self::PERM_PAYROLL_GENERATE,
        self::PERM_PAYROLL_PAY,
        self::PERM_EXPENSES_VIEW,
        self::PERM_EXPENSES_CREATE,
        self::PERM_EXPENSES_UPDATE,
        self::PERM_EXPENSES_DELETE,
        self::PERM_ATTENDANCE_VIEW,
        self::PERM_ATTENDANCE_CREATE,
        self::PERM_ATTENDANCE_UPDATE,
        self::PERM_ATTENDANCE_DELETE,
    ];
}
