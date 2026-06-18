export type DashboardRole = "owner" | "admin" | "staff";

export type DashboardUser = {
  name: string;
  email: string;
  imageUrl?: string;
  role: DashboardRole;
  permissions?: string[];
};

export type DashboardNavIcon =
  | "BarChart3"
  | "Bell"
  | "ClipboardList"
  | "CreditCard"
  | "Download"
  | "Dumbbell"
  | "Home"
  | "Package"
  | "Percent"
  | "ReceiptText"
  | "Settings"
  | "ShieldCheck"
  | "ShoppingCart"
  | "Users";

export type DashboardNavLink = {
  href: string;
  icon: DashboardNavIcon;
  labelKey:
    | "audit"
    | "commissions"
    | "dashboard"
    | "expenses"
    | "exports"
    | "members"
    | "notifications"
    | "payments"
    | "payroll"
    | "plans"
    | "pos"
    | "products"
    | "reports"
    | "roles"
    | "sales"
    | "settings"
    | "subscriptions"
    | "teams"
    | "trainers";
  roles: DashboardRole[];
  permissions?: string[];
};

export type DashboardNavItem = {
  sectionKey: "admin" | "finance" | "operations" | "overview";
  items: DashboardNavLink[];
};
