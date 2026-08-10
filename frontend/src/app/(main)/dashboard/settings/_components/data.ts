import { serverApiFetch } from "@/lib/api/server";
import { type WhatsAppTemplateKey, type WhatsAppTemplates, whatsappTemplateKeys } from "@/lib/whatsapp-templates";

export type DashboardSettings = {
  attendance: {
    default_grace_minutes: number;
    /** Seconds-apart scans treated as the same one, so the desk is not asked. */
    duplicate_scan_grace_minutes: number;
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
  payroll?: {
    clean_attendance_bonus_enabled: boolean;
    clean_attendance_bonus_percentage: number;
    coach_performance_bonus_enabled: boolean;
    coach_performance_bonus_percentage: number;
    default_pay_day: number;
    schedule_mode: "fixed" | "per_employee";
  };
  shifts?: {
    /** Whether the scheduler opens the desk on its own. Off means staff start it by hand. */
    auto_open_enabled: boolean;
    /** Whether staff must count the drawer and get a manager review to finish a shift. */
    require_cash_count: boolean;
    /** Whether a shift may only be opened inside its scheduled hours. */
    enforce_schedule_window: boolean;
    handover_auto_accept: boolean;
    handover_auto_accept_on_match_only: boolean;
    require_handover_to_open: boolean;
  };
  receipt_template: string;
  reminder_days: number[];
  vat_rate: number;
  whatsapp: {
    templates: WhatsAppTemplates;
    /** Master switch for sending member messages without staff pressing send. */
    auto_send: boolean;
    /** Per-event opt-in. The backend always returns every key. */
    auto_events: Record<WhatsAppTemplateKey, boolean>;
  };
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
  off_rotation?: {
    id: number;
    off_weekday: number;
    rotation_start_date: string | null;
    employee_order: number[];
    is_active: boolean;
  } | null;
  rotation_preview?: Array<{
    week_start: string;
    off_date: string;
    employee_id: number | null;
  }>;
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

/**
 * Every automatic message off.
 *
 * The fallback used whenever the settings request fails: a failed read must not
 * render toggles suggesting members are already being messaged automatically.
 */
export const emptyWhatsAppAutoEvents = Object.fromEntries(whatsappTemplateKeys.map((key) => [key, false])) as Record<
  WhatsAppTemplateKey,
  boolean
>;

const emptySettings: DashboardSettings = {
  attendance: {
    default_grace_minutes: 15,
    duplicate_scan_grace_minutes: 2,
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
  payroll: {
    clean_attendance_bonus_enabled: true,
    clean_attendance_bonus_percentage: 2,
    coach_performance_bonus_enabled: true,
    coach_performance_bonus_percentage: 3,
    default_pay_day: 30,
    schedule_mode: "fixed",
  },
  shifts: {
    auto_open_enabled: false,
    require_cash_count: false,
    enforce_schedule_window: false,
    handover_auto_accept: false,
    handover_auto_accept_on_match_only: true,
    require_handover_to_open: false,
  },
  receipt_template: "default",
  reminder_days: [7],
  vat_rate: 14,
  whatsapp: { templates: {}, auto_send: false, auto_events: emptyWhatsAppAutoEvents },
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
