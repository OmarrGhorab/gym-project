import { serverApiFetch } from "@/lib/api/server";
import { type WhatsAppTemplateKey, type WhatsAppTemplates, whatsappTemplateKeys } from "@/lib/whatsapp-templates";

export type DashboardSettings = {
  attendance: {
    /** Seconds-apart scans treated as the same one, so the desk is not asked. */
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
  shifts?: {
    /** Whether the scheduler opens the desk on its own. Off means staff start it by hand. */
    /** Whether staff must count the drawer and get a manager review to finish a shift. */
    require_cash_count: boolean;
    /** Whether a shift may only be opened inside its scheduled hours. */
    handover_auto_accept: boolean;
    handover_auto_accept_on_match_only: boolean;
    require_handover_to_open: boolean;
    /** The hour the working day turns over and a shift opens on an empty drawer. */
    day_starts_at_hour: number;
    /** How long the desk must sit shut before the next shift starts on an empty drawer. */
    reset_after_closed_hours: number;
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
  is_active: boolean;
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
  shifts: {
    require_cash_count: false,
    handover_auto_accept: false,
    handover_auto_accept_on_match_only: true,
    require_handover_to_open: false,
    day_starts_at_hour: 5,
    reset_after_closed_hours: 4,
  },
  receipt_template: "default",
  reminder_days: [7],
  vat_rate: 14,
  whatsapp: { templates: {}, auto_send: false, auto_events: emptyWhatsAppAutoEvents },
};

export async function getSettingsPageData() {
  const [settings, shifts] = await Promise.all([
    safeFetch<DashboardSettings>("/settings", emptySettings),
    safeFetch<EmployeeShift[]>("/attendance/shifts/manage", []),
  ]);

  return { settings, shifts };
}

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const result = await serverApiFetch<T>(path);

    return result.data;
  } catch {
    return fallback;
  }
}
