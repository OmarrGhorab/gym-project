import type { DashboardUser } from "@/lib/session";

/**
 * Money-visibility gating for the dashboard.
 *
 * Seeing a record and seeing what it cost are separate grants. Every figure in
 * the dashboard belongs to one money domain, and a role sees that domain's
 * figures only when it holds the matching permission. All ten start Admin-only;
 * an administrator opens them up from the roles screen.
 *
 * Mirrors `backend/app/Support/MoneyPermissions.php` — keep the two in step.
 */

export const MONEY_DOMAINS = [
  "subscriptions",
  "plans",
  "sales",
  "products",
  "payments",
  "expenses",
  "payroll",
  "commissions",
  "reports",
  "dashboard",
] as const;

export type MoneyDomain = (typeof MONEY_DOMAINS)[number];

export const moneyPermission = (domain: MoneyDomain) => `money.${domain}.view` as const;

export const MONEY_PERMISSIONS = MONEY_DOMAINS.map(moneyPermission);

/** Dashboard pages whose figures each domain governs; mirrors the backend PAGE_MAP. */
export const MONEY_DOMAIN_PAGES: Record<MoneyDomain, string[]> = {
  subscriptions: ["/dashboard/members", "/dashboard/crm"],
  plans: ["/dashboard/plans"],
  sales: ["/dashboard/ecommerce", "/dashboard/finance"],
  products: ["/dashboard/logistics"],
  payments: ["/dashboard/members", "/dashboard/invoice"],
  expenses: ["/dashboard/finance", "/dashboard/logistics"],
  payroll: ["/dashboard/payroll", "/dashboard/absences"],
  commissions: ["/dashboard/academy", "/dashboard/payroll"],
  reports: ["/dashboard/reports", "/dashboard/finance", "/dashboard/analytics"],
  dashboard: ["/dashboard/default"],
};

/** Placeholder rendered in place of a figure the current role may not see. */
export const MONEY_REDACTED = "—";

export type MoneyAccess = Readonly<Record<MoneyDomain, boolean>>;

/** No domain visible — the safe default when a session cannot be resolved. */
export const NO_MONEY_ACCESS: MoneyAccess = Object.freeze(
  Object.fromEntries(MONEY_DOMAINS.map((domain) => [domain, false])) as Record<MoneyDomain, boolean>,
);

export function canViewMoney(user: Pick<DashboardUser, "permissions"> | null | undefined, domain: MoneyDomain) {
  return Boolean(user?.permissions.includes(moneyPermission(domain)));
}

/**
 * Resolve every domain once so a server page can hand a plain object to client
 * components instead of threading the permission list through each of them.
 */
export function resolveMoneyAccess(user: Pick<DashboardUser, "permissions"> | null | undefined): MoneyAccess {
  if (!user) {
    return NO_MONEY_ACCESS;
  }

  return Object.freeze(
    Object.fromEntries(MONEY_DOMAINS.map((domain) => [domain, canViewMoney(user, domain)])) as Record<
      MoneyDomain,
      boolean
    >,
  );
}

/** True when the role sees none of the given domains, so a whole card or column can be dropped. */
export function hidesAllMoney(access: MoneyAccess, domains: readonly MoneyDomain[]) {
  return domains.every((domain) => !access[domain]);
}
