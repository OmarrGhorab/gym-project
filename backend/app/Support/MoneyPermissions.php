<?php

namespace App\Support;

/**
 * Authoritative constants for money-visibility permissions.
 *
 * Why a separate family instead of reusing the existing `*.view` permissions?
 * Seeing a record and seeing what it cost are different decisions. A captain
 * needs the member list without the balances; a cashier needs the plan catalog
 * without the margins. Splitting visibility from money lets an operator hand out
 * a page while keeping its figures back.
 *
 * Every permission here is withheld from all preset roles except Admin (see
 * RoleMatrixSeeder). Granting one is a deliberate act by an administrator on the
 * roles screen.
 *
 * Permissions are sliced by data domain rather than by dashboard page because a
 * single API resource feeds several pages — gating the domain closes every
 * surface at once instead of leaving whichever page nobody remembered. The
 * PAGE_MAP below records which dashboard pages each domain governs so the roles
 * screen can explain the effect of a checkbox in the operator's own terms.
 */
final class MoneyPermissions
{
    /** Subscription prices, discounts, paid totals, balances, and refunds. */
    public const PERM_MONEY_SUBSCRIPTIONS_VIEW = 'money.subscriptions.view';

    /** Membership plan prices and package item pricing. */
    public const PERM_MONEY_PLANS_VIEW = 'money.plans.view';

    /** POS sale totals, line totals, discounts, and shift-desk cash figures. */
    public const PERM_MONEY_SALES_VIEW = 'money.sales.view';

    /** Product price and cost, purchase-order values, and stock valuation. */
    public const PERM_MONEY_PRODUCTS_VIEW = 'money.products.view';

    /** Individual payment amounts and outstanding dues. */
    public const PERM_MONEY_PAYMENTS_VIEW = 'money.payments.view';

    /** Expense amounts and expense category totals. */
    public const PERM_MONEY_EXPENSES_VIEW = 'money.expenses.view';

    /** Salaries, bonuses, deductions, and net pay. */
    public const PERM_MONEY_PAYROLL_VIEW = 'money.payroll.view';

    /** Commission rates and earned commission amounts. */
    public const PERM_MONEY_COMMISSIONS_VIEW = 'money.commissions.view';

    /** Financial report aggregates: revenue, income vs outcome, finance summary. */
    public const PERM_MONEY_REPORTS_VIEW = 'money.reports.view';

    /** Revenue and takings figures on the main dashboard. */
    public const PERM_MONEY_DASHBOARD_VIEW = 'money.dashboard.view';

    /** All money-visibility permissions in seeding order. */
    public const ALL_PERMISSIONS = [
        self::PERM_MONEY_SUBSCRIPTIONS_VIEW,
        self::PERM_MONEY_PLANS_VIEW,
        self::PERM_MONEY_SALES_VIEW,
        self::PERM_MONEY_PRODUCTS_VIEW,
        self::PERM_MONEY_PAYMENTS_VIEW,
        self::PERM_MONEY_EXPENSES_VIEW,
        self::PERM_MONEY_PAYROLL_VIEW,
        self::PERM_MONEY_COMMISSIONS_VIEW,
        self::PERM_MONEY_REPORTS_VIEW,
        self::PERM_MONEY_DASHBOARD_VIEW,
    ];

    /**
     * Dashboard pages whose money figures each permission governs.
     *
     * Kept here so the roles screen and this class cannot drift apart; the
     * frontend mirrors the same mapping in `src/lib/money-visibility.ts`.
     *
     * @var array<string, list<string>>
     */
    public const PAGE_MAP = [
        self::PERM_MONEY_SUBSCRIPTIONS_VIEW => ['/dashboard/members', '/dashboard/crm'],
        self::PERM_MONEY_PLANS_VIEW => ['/dashboard/plans'],
        self::PERM_MONEY_SALES_VIEW => ['/dashboard/ecommerce', '/dashboard/finance'],
        self::PERM_MONEY_PRODUCTS_VIEW => ['/dashboard/logistics'],
        self::PERM_MONEY_PAYMENTS_VIEW => ['/dashboard/members', '/dashboard/invoice'],
        self::PERM_MONEY_EXPENSES_VIEW => ['/dashboard/finance', '/dashboard/logistics'],
        self::PERM_MONEY_PAYROLL_VIEW => ['/dashboard/payroll', '/dashboard/absences'],
        self::PERM_MONEY_COMMISSIONS_VIEW => ['/dashboard/academy', '/dashboard/payroll'],
        self::PERM_MONEY_REPORTS_VIEW => ['/dashboard/reports', '/dashboard/finance', '/dashboard/analytics'],
        self::PERM_MONEY_DASHBOARD_VIEW => ['/dashboard/default'],
    ];
}
