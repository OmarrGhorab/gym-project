import { serverApiFetch } from "@/lib/api/server";

export type LiveAttendanceHourlyPoint = {
  hour: string;
  members: number;
  staff: number;
  total: number;
};

export type LiveAttendanceScanMethod = {
  method: string;
  count: number;
};

export type LiveAttendanceInsideRow = {
  id: string;
  name: string;
  type: "member" | "staff";
  role?: string | null;
  check_in_at: string | null;
  duration_minutes: number;
  scan_method: string | null;
  status: string;
  location_status: string | null;
};

export type LiveAttendanceAlert = {
  id: string;
  severity: "high" | "medium" | "low";
  type: "member" | "staff";
  name: string;
  message: string;
  time: string | null;
};

export type LiveAttendanceData = {
  generated_at: string;
  currently_inside: {
    total: number;
    members: number;
    staff: number;
  };
  today: {
    member_visits: number;
    staff_checkins: number;
    flagged_scans: number;
    blocked_visits: number;
    late_staff: number;
    peak_hour: string | null;
  };
  hourly: LiveAttendanceHourlyPoint[];
  scan_methods: LiveAttendanceScanMethod[];
  currently_inside_rows: LiveAttendanceInsideRow[];
  alerts: LiveAttendanceAlert[];
};

const emptyLiveAttendanceData: LiveAttendanceData = {
  generated_at: new Date().toISOString(),
  currently_inside: {
    total: 0,
    members: 0,
    staff: 0,
  },
  today: {
    member_visits: 0,
    staff_checkins: 0,
    flagged_scans: 0,
    blocked_visits: 0,
    late_staff: 0,
    peak_hour: null,
  },
  hourly: [],
  scan_methods: [],
  currently_inside_rows: [],
  alerts: [],
};

export async function getLiveAttendanceData(): Promise<LiveAttendanceData> {
  try {
    const result = await serverApiFetch<LiveAttendanceData>("/reports/live-attendance");

    return result.data;
  } catch {
    return emptyLiveAttendanceData;
  }
}
