import { serverApiFetch } from "@/lib/api/server";

export type StaffAcademyKpi = {
  label: string;
  value: number | string;
  detail: string;
  trend: string | null;
};

export type StaffAcademyShift = {
  id: number;
  name: string;
  time: string;
  date: string;
  staff_count: number;
  grace_minutes: number;
  status: "completed" | "in_progress" | "upcoming";
};

export type StaffAcademyWarningStatus = {
  label: string;
  approved: number;
  pending: number;
  auto_applied: number;
};

export type StaffAcademyPerformance = {
  employee_id: number;
  name: string;
  role: string;
  initials: string;
  score: number;
  attendance_count: number;
  commissions_total: string;
  warnings_count: number;
  start: number;
  duration: number;
};

export type StaffAcademyEvent = {
  id: string;
  date: string | null;
  title: string;
  time: string;
  type: string;
};

export type StaffAcademyData = {
  generated_at: string;
  kpis: StaffAcademyKpi[];
  shift_schedule: StaffAcademyShift[];
  warning_status: StaffAcademyWarningStatus[];
  performance_highlights: StaffAcademyPerformance[];
  upcoming_events: StaffAcademyEvent[];
  today: {
    checked_in: number;
    late: number;
    off_shift: number;
    pending_approval: number;
  };
};

const emptyStaffAcademyData: StaffAcademyData = {
  generated_at: new Date().toISOString(),
  kpis: [
    { detail: "employees and captains in service", label: "Active Staff", trend: null, value: 0 },
    { detail: "0 attended this month", label: "Staff Attendance", trend: null, value: "0.0%" },
    { detail: "needs admin decision", label: "Warnings Pending", trend: null, value: 0 },
    { detail: "pending salary receipts", label: "Payroll Receipts", trend: null, value: 0 },
  ],
  shift_schedule: [],
  warning_status: [
    { approved: 0, auto_applied: 0, label: "Late", pending: 0 },
    { approved: 0, auto_applied: 0, label: "Absence", pending: 0 },
    { approved: 0, auto_applied: 0, label: "Off shift", pending: 0 },
  ],
  performance_highlights: [],
  upcoming_events: [],
  today: {
    checked_in: 0,
    late: 0,
    off_shift: 0,
    pending_approval: 0,
  },
};

export async function getStaffAcademyData(): Promise<StaffAcademyData> {
  try {
    const result = await serverApiFetch<StaffAcademyData>("/reports/staff-academy");

    return result.data;
  } catch {
    return emptyStaffAcademyData;
  }
}
