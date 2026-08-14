<?php

namespace App\Support;

/**
 * Authoritative constants for Phase 2 POS, products, and inventory module permissions.
 */
final class PosPermissions
{
    public const PERM_PRODUCTS_VIEW = 'products.view';

    public const PERM_PRODUCTS_CREATE = 'products.create';

    public const PERM_PRODUCTS_UPDATE = 'products.update';

    public const PERM_PRODUCTS_DELETE = 'products.delete';

    public const PERM_SALES_VIEW = 'sales.view';

    public const PERM_SALES_CREATE = 'sales.create';

    public const PERM_SALES_VOID = 'sales.void';

    public const PERM_INVENTORY_ADJUST = 'inventory.adjust';

    public const PERM_REPORTS_VIEW = 'reports.view';

    public const PERM_REPORTS_VIEW_TODAY = 'reports.view_today';

    /** All Phase 2 POS permissions in seeding order. */
    public const ALL_PERMISSIONS = [
        self::PERM_PRODUCTS_VIEW,
        self::PERM_PRODUCTS_CREATE,
        self::PERM_PRODUCTS_UPDATE,
        self::PERM_PRODUCTS_DELETE,
        self::PERM_SALES_VIEW,
        self::PERM_SALES_CREATE,
        self::PERM_SALES_VOID,
        self::PERM_INVENTORY_ADJUST,
        self::PERM_REPORTS_VIEW,
        self::PERM_REPORTS_VIEW_TODAY,
    ];
}
