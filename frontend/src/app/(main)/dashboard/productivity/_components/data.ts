import { serverApiFetch } from "@/lib/api/server";

export type OperationsTask = {
  id: string;
  title: string;
  tag: string;
  priority: "high" | "medium" | "low";
  due_label: string;
  href: string;
};

export type OperationsWorkflow = {
  title: string;
  status: string;
  description: string;
  progress: number;
  footer: string;
  href: string;
};

export type OperationsQuickAction = {
  label: string;
  href: string;
};

export type OperationsCalendarEvent = {
  id?: number;
  date: string;
  title: string;
  type: string;
  notes?: string | null;
  editable?: boolean;
};

export type OperationsActivity = {
  id: number;
  title: string;
  description: string;
  created_at: string | null;
};

export type OperationsSummaryData = {
  generated_at: string;
  summary: {
    today_action_count: number;
    pending_review_count: number;
    week_progress: number;
    focus_title: string;
    focus_description: string;
  };
  tasks: OperationsTask[];
  workflows: OperationsWorkflow[];
  quick_actions: OperationsQuickAction[];
  calendar_events: OperationsCalendarEvent[];
  activity: OperationsActivity[];
  week: {
    label: string;
    progress: number;
    completed: number;
    total: number;
    member_visits: number;
    subscriptions_renewed: number;
    sales: number;
    payroll_paid: number;
  };
};

const emptyOperationsData: OperationsSummaryData = {
  generated_at: new Date().toISOString(),
  summary: {
    today_action_count: 0,
    pending_review_count: 0,
    week_progress: 100,
    focus_title: "Gym Ops",
    focus_description: "No urgent operations need attention.",
  },
  tasks: [],
  workflows: [],
  quick_actions: [
    { label: "Attendance Review", href: "/dashboard/analytics" },
    { label: "Membership Follow-up", href: "/dashboard/crm" },
    { label: "Finance Collections", href: "/dashboard/finance" },
    { label: "Payroll", href: "/dashboard/finance" },
    { label: "Products", href: "/dashboard/ecommerce" },
  ],
  calendar_events: [],
  activity: [],
  week: {
    label: "This Week",
    progress: 100,
    completed: 0,
    total: 0,
    member_visits: 0,
    subscriptions_renewed: 0,
    sales: 0,
    payroll_paid: 0,
  },
};

export async function getOperationsSummaryData(): Promise<OperationsSummaryData> {
  try {
    const result = await serverApiFetch<OperationsSummaryData>("/reports/operations-summary");

    return result.data;
  } catch {
    return emptyOperationsData;
  }
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(date);
}
