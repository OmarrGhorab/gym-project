import { serverApiFetch } from "@/lib/api/server";

export type DashboardSettings = {
  attendance: {
    default_grace_minutes: number;
    gym_latitude: number | null;
    gym_longitude: number | null;
    gym_radius_meters: number;
  };
  currency: string;
  gym: {
    colors: {
      primary: string;
      secondary: string;
    };
    logo: string | null;
    name: string;
  };
  receipt_template: string;
  reminder_days: number;
  vat_rate: number;
};

export type EmployeeShift = {
  id: number;
  name: string;
  starts_at: string;
  ends_at: string;
  grace_minutes: number;
  off_days: number[];
  off_day_bonus_enabled: boolean;
  off_day_bonus_amount: string;
  is_active: boolean;
};

export type ViolationRule = {
  id: number;
  code: string;
  name: string;
  description: string | null;
  threshold_minutes: number | null;
  warning_count_before_deduction: number;
  deduction_days: string;
  requires_admin_approval: boolean;
  auto_apply_if_unreviewed: boolean;
  is_active: boolean;
  updated_at: string | null;
};

const emptySettings: DashboardSettings = {
  attendance: {
    default_grace_minutes: 15,
    gym_latitude: null,
    gym_longitude: null,
    gym_radius_meters: 150,
  },
  currency: "EGP",
  gym: {
    colors: {
      primary: "#000000",
      secondary: "#ffffff",
    },
    logo: null,
    name: "ATP Gym",
  },
  receipt_template: "default",
  reminder_days: 7,
  vat_rate: 14,
};

export async function getSettingsPageData() {
  const [settings, shifts, rules] = await Promise.all([
    safeFetch<DashboardSettings>("/settings", emptySettings),
    safeFetch<EmployeeShift[]>("/attendance/shifts/manage", []),
    safeFetch<ViolationRule[]>("/attendance/violation-rules", []),
  ]);

  return { rules, settings, shifts };
}

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const result = await serverApiFetch<T>(path);

    return result.data;
  } catch {
    return fallback;
  }
}
