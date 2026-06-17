export type DashboardRole = "owner" | "admin" | "staff";

export type DashboardUser = {
  name: string;
  email: string;
  imageUrl?: string;
  role: DashboardRole;
};

export type DashboardNavIcon =
  | "BarChart3"
  | "CreditCard"
  | "Dumbbell"
  | "Home"
  | "Settings"
  | "UserCheck"
  | "Users";

export type DashboardNavLink = {
  href: string;
  icon: DashboardNavIcon;
  labelKey:
    | "attendance"
    | "dashboard"
    | "members"
    | "payments"
    | "reports"
    | "settings"
    | "subscriptions"
    | "teams"
    | "trainers";
  roles: DashboardRole[];
};

export type DashboardNavItem = {
  sectionKey: "finance" | "operations" | "overview";
  items: DashboardNavLink[];
};
