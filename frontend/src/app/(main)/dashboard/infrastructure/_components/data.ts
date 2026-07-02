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
  api_health: {
    ok: boolean;
    data: unknown;
  };
  protected_sample: {
    ok: boolean;
    data: unknown;
  };
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
  api_health: {
    ok: false,
    data: null,
  },
  protected_sample: {
    ok: false,
    data: null,
  },
};

export async function getSystemHealthData(): Promise<SystemHealthData> {
  try {
    const [result, apiHealth, protectedSample] = await Promise.all([
      serverApiFetch<SystemHealthData>("/reports/system-health"),
      safeProbe("/health"),
      safeProbe("/foundation/protected-sample"),
    ]);

    return {
      ...result.data,
      api_health: apiHealth,
      protected_sample: protectedSample,
    };
  } catch {
    return emptySystemHealthData;
  }
}

async function safeProbe(path: string): Promise<{ ok: boolean; data: unknown }> {
  try {
    const result = await serverApiFetch<unknown>(path);

    return { ok: true, data: result.data };
  } catch (error) {
    return {
      ok: false,
      data: error instanceof Error ? error.message : null,
    };
  }
}
