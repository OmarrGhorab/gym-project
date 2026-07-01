import { serverApiFetch } from "@/lib/api/server";

export type LiveAttendanceHourlyPoint = {
  hour: string;
  members: number;
  staff: number;
  total: number;
  value: number;
  comparison: number;
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
  filters: LiveAttendanceFilters;
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

export type LiveAttendanceFilters = {
  date: string;
  hours: number;
  audience: "all" | "members" | "staff";
  metric: "occupancy" | "entries" | "alerts";
};

export type LiveAttendanceFilterInput = Partial<Record<keyof LiveAttendanceFilters, string | number | undefined>>;

const emptyLiveAttendanceData: LiveAttendanceData = {
  generated_at: new Date().toISOString(),
  filters: {
    date: new Date().toISOString().slice(0, 10),
    hours: 24,
    audience: "all",
    metric: "occupancy",
  },
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

export async function getLiveAttendanceData(filters: LiveAttendanceFilterInput = {}): Promise<LiveAttendanceData> {
  try {
    const query = buildLiveAttendanceQuery(filters);
    const result = await serverApiFetch<LiveAttendanceData>(`/reports/live-attendance${query}`);

    return normalizeLiveAttendanceData(result.data);
  } catch {
    return emptyLiveAttendanceData;
  }
}

function buildLiveAttendanceQuery(filters: LiveAttendanceFilterInput) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") {
      params.set(key, String(value));
    }
  }

  const query = params.toString();

  return query ? `?${query}` : "";
}

function normalizeLiveAttendanceData(data: LiveAttendanceData): LiveAttendanceData {
  if (data.hourly.some((point) => point.total > 0) || data.currently_inside.total === 0) {
    return data;
  }

  const hourly = data.hourly.length > 0 ? data.hourly : buildEmptyHourlySeries();
  const currentHour = getHourLabel(data.generated_at);

  return {
    ...data,
    hourly: hourly.map((point) =>
      point.hour === currentHour
        ? {
            ...point,
            members: data.currently_inside.members,
            staff: data.currently_inside.staff,
            total: data.currently_inside.total,
            value: data.currently_inside.total,
            comparison: point.comparison ?? 0,
          }
        : point,
    ),
  };
}

function buildEmptyHourlySeries(): LiveAttendanceHourlyPoint[] {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour: `${String(hour).padStart(2, "0")}:00`,
    members: 0,
    staff: 0,
    total: 0,
    value: 0,
    comparison: 0,
  }));
}

function getHourLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return `${String(new Date().getHours()).padStart(2, "0")}:00`;
  }

  return `${String(date.getHours()).padStart(2, "0")}:00`;
}
