import { serverApiFetch } from "@/lib/api/server";

export type OperationsCalendarEvent = {
  id: number | string;
  source_id: number | null;
  source: "custom" | "subscription" | "payroll" | "product" | "attendance";
  date: string;
  start: string | null;
  end: string | null;
  all_day: boolean;
  title: string;
  type: CalendarEventType;
  custom_type_label: string | null;
  status: CalendarEventStatus;
  notes: string | null;
  editable: boolean;
  location: string | null;
  assigned_employee: {
    id: number;
    name: string;
    role: string | null;
  } | null;
  assigned_employees: Array<{
    id: number;
    name: string;
    role: string | null;
  }>;
};

export type CalendarEventType =
  | "manual"
  | "shift"
  | "class"
  | "pt_session"
  | "training"
  | "meeting"
  | "sales"
  | "maintenance"
  | "cleaning"
  | "renewal"
  | "payroll"
  | "attendance"
  | "inventory"
  | "finance";

export type CalendarEventStatus = "scheduled" | "done" | "cancelled" | "delayed";

export type CalendarEmployeeOption = {
  id: number;
  name: string;
  role: string | null;
};

type EmployeesResponse = {
  data?: CalendarEmployeeOption[];
};

export async function getCalendarPageData() {
  const [eventsResult, employeesResult] = await Promise.all([
    safeFetch<OperationsCalendarEvent[]>("/reports/operations-calendar-events"),
    safeFetch<EmployeesResponse | CalendarEmployeeOption[]>("/employees?per_page=100"),
  ]);

  const employeesPayload = employeesResult.data;
  const employees = Array.isArray(employeesPayload) ? employeesPayload : (employeesPayload.data ?? []);

  return {
    events: eventsResult.data,
    employees,
  };
}

async function safeFetch<T>(path: string): Promise<{ data: T }> {
  try {
    return await serverApiFetch<T>(path);
  } catch {
    return { data: [] as T };
  }
}
