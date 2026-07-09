import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { DashboardUser } from "@/lib/session";
import { type NavGroup, type NavMainItem, sidebarItems } from "@/navigation/sidebar/sidebar-items";

type PermissionRequirement = string | string[];

export const routePermissions: Record<string, PermissionRequirement> = {
  "/dashboard": "dashboard.view",
  "/dashboard/default": "dashboard.view",
  "/dashboard/default-v1": "dashboard.view",
  "/dashboard/crm": "subscriptions.view",
  "/dashboard/crm-v1": "subscriptions.view",
  "/dashboard/finance": [
    "reports.view",
    "payments.view",
    "payments.create",
    "payroll.view",
    "expenses.view",
    "expenses.create",
    "expenses.update",
    "expenses.delete",
    "export.reports",
  ],
  "/dashboard/finance-v1": [
    "reports.view",
    "payments.view",
    "payments.create",
    "payroll.view",
    "expenses.view",
    "expenses.create",
    "expenses.update",
    "expenses.delete",
    "export.reports",
  ],
  "/dashboard/analytics": "reports.view",
  "/dashboard/analytics-v1": "reports.view",
  "/dashboard/productivity": "reports.view",
  "/dashboard/ecommerce": "sales.view",
  "/dashboard/academy": "employees.view",
  "/dashboard/academy/staff": "employees.view",
  "/dashboard/logistics": ["products.view", "expenses.create"],
  "/dashboard/infrastructure": "audit.view",
  "/dashboard/mail": "notifications.view",
  "/dashboard/calendar": "reports.view",
  "/dashboard/attendance": "attendance.view",
  "/dashboard/members": "members.view",
  "/dashboard/kanban": "reports.view",
  "/dashboard/tasks": "reports.view",
  "/dashboard/invoice": [
    "export.members",
    "export.sales",
    "export.payroll",
    "export.reports",
    "payments.view",
    "payroll.view",
  ],
  "/dashboard/payroll": "payroll.view",
  "/dashboard/plans": "plans.view",
  "/dashboard/users": "roles.manage",
  "/dashboard/roles": "roles.manage",
  "/dashboard/audit": "audit.view",
  "/dashboard/settings": "settings.manage",
  "/dashboard/coming-soon": "dashboard.view",
  "/dashboard/[...not-found]": "dashboard.view",
};

export const actionPermissions = {
  createMember: "members.create",
  viewNotifications: "notifications.view",
} as const;

export function canAccess(user: Pick<DashboardUser, "permissions">, requirement?: PermissionRequirement) {
  if (!requirement) {
    return true;
  }

  const permissions = new Set(user.permissions);
  const required = Array.isArray(requirement) ? requirement : [requirement];

  return required.some((permission) => permissions.has(permission));
}

export function canAccessRoute(user: Pick<DashboardUser, "permissions">, pathname: string) {
  const requirement = getRoutePermission(pathname);

  if (!requirement) {
    return false;
  }

  return canAccess(user, requirement);
}

export function filterSidebarItems(
  user: Pick<DashboardUser, "permissions">,
  groups: readonly NavGroup[] = sidebarItems,
) {
  return groups
    .map((group) => ({
      ...group,
      items: group.items.map((item) => filterNavItem(user, item)).filter((item): item is NavMainItem => Boolean(item)),
    }))
    .filter((group) => group.items.length > 0);
}

export function firstAccessibleDashboardPath(user: Pick<DashboardUser, "permissions">) {
  const firstItem = filterSidebarItems(user)[0]?.items[0];

  if (!firstItem) {
    return "/dashboard/[...not-found]";
  }

  return "url" in firstItem ? firstItem.url : (firstItem.subItems[0]?.url ?? "/dashboard/[...not-found]");
}

export function normalizeDashboardPath(pathname: string) {
  const path = pathname.split("?")[0] ?? pathname;

  return path.replace(/\/+$/, "") || "/";
}

function getRoutePermission(pathname: string) {
  const normalizedPath = normalizeDashboardPath(pathname);

  if (!normalizedPath.startsWith("/dashboard")) {
    return undefined;
  }

  return Object.entries(routePermissions)
    .sort(([left], [right]) => right.length - left.length)
    .find(
      ([route]) => normalizedPath === route || (route !== "/dashboard" && normalizedPath.startsWith(`${route}/`)),
    )?.[1];
}

export function AccessDenied({
  action,
  description,
  homeHref = "/dashboard/default",
  title,
}: {
  action: string;
  description: string;
  homeHref?: string;
  title: string;
}) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex max-w-md flex-col items-center gap-4 rounded-xl border bg-card p-8 text-center text-card-foreground">
        <span className="rounded-full bg-muted p-3 text-muted-foreground">
          <ShieldAlert className="size-6" />
        </span>
        <div className="space-y-1">
          <h1 className="font-medium text-xl">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <Button render={<a href={homeHref} />} nativeButton={false} variant="outline">
          {action}
        </Button>
      </div>
    </div>
  );
}

function filterNavItem(user: Pick<DashboardUser, "permissions">, item: NavMainItem): NavMainItem | null {
  if ("subItems" in item && item.subItems) {
    const subItems = item.subItems.filter((subItem) => canAccessRoute(user, subItem.url));

    return subItems.length > 0 ? { ...item, subItems } : null;
  }

  return canAccessRoute(user, item.url) ? item : null;
}
