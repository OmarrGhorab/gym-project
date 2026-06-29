import { serverApiFetch } from "@/lib/api/server";

export type SystemHealthStatus = "ready" | "warning" | "critical" | "inactive";

export type SystemHealthCheck = {
  label: string;
  value: string;
  status: SystemHealthStatus;
};

export type SystemHealthRow = {
  name: string;
  description: string;
  status: SystemHealthStatus;
  category: string;
  metric: string;
  last_activity: string | null;
  checks: SystemHealthCheck[];
  href: string;
};

export type SystemHealthGroup = {
  name: string;
  description: string;
  rows: SystemHealthRow[];
};

export type SystemHealthWarning = {
  title: string;
  description: string;
  status: SystemHealthStatus;
  href: string;
};

export type SystemHealthAudit = {
  id: number;
  log_name: string;
  description: string;
  event: string | null;
  causer: string | null;
  created_at: string | null;
};

export type SystemHealthData = {
  generated_at: string;
  summary: {
    modules_count: number;
    ready_count: number;
    warning_count: number;
    critical_count: number;
    setup_score: number;
    audit_events_count: number;
  };
  groups: SystemHealthGroup[];
  setup_warnings: SystemHealthWarning[];
  audit_activity: SystemHealthAudit[];
};

const emptySystemHealthData: SystemHealthData = {
  generated_at: new Date().toISOString(),
  summary: {
    modules_count: 0,
    ready_count: 0,
    warning_count: 0,
    critical_count: 0,
    setup_score: 0,
    audit_events_count: 0,
  },
  groups: [],
  setup_warnings: [],
  audit_activity: [],
};

export async function getSystemHealthData(): Promise<SystemHealthData> {
  try {
    const result = await serverApiFetch<SystemHealthData>("/reports/system-health");

    return result.data;
  } catch {
    return emptySystemHealthData;
  }
}
