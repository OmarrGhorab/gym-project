import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";

export type BadgeSubject = {
  id: number;
  name: string;
  subtitle: string | null;
  attendance_code: string | null;
  attendance_qr: string | null;
};

type EmployeeRow = {
  id: number;
  name?: string | null;
  role?: string | null;
  attendance_code?: string | null;
  attendance_qr?: string | null;
};

type MemberRow = {
  id: number;
  name?: string | null;
  phone?: string | null;
  attendance_code?: string | null;
  attendance_qr?: string | null;
};

export type BadgeType = "employee" | "member";

/**
 * Badges encode the bare attendance code ("M-…" / "E-…") rather than the
 * prefixed payload. The prefix already identifies the type, and Code128 spends
 * ~11 modules per character, so dropping it meaningfully narrows the symbol.
 * The scan stations accept either form, so no API contract changes.
 */
export async function getBadgeSubjects(type: BadgeType): Promise<BadgeSubject[]> {
  if (type === "member") {
    const members = await safeFetch<MemberRow[] | PaginatedData<MemberRow>>("/members?per_page=200", []);

    return unwrapList(members)
      .map((member) => ({
        id: member.id,
        name: member.name ?? `Member #${member.id}`,
        subtitle: member.phone ?? null,
        attendance_code: member.attendance_code ?? null,
        attendance_qr: member.attendance_qr ?? fallbackPayload("member", member.attendance_code),
      }))
      .filter((subject) => Boolean(subject.attendance_code));
  }

  const employees = await safeFetch<EmployeeRow[] | PaginatedData<EmployeeRow>>(
    "/attendance/employee-options?per_page=200",
    [],
  );

  return unwrapList(employees)
    .map((employee) => ({
      id: employee.id,
      name: employee.name ?? `Employee #${employee.id}`,
      subtitle: employee.role ?? null,
      attendance_code: employee.attendance_code ?? null,
      attendance_qr: employee.attendance_qr ?? fallbackPayload("employee", employee.attendance_code),
    }))
    .filter((subject) => Boolean(subject.attendance_code));
}

function fallbackPayload(type: BadgeType, code: string | null | undefined): string | null {
  return code ? `${type}:${code}` : null;
}

async function safeFetch<T>(path: string, fallback: T): Promise<T> {
  try {
    const result = await serverApiFetch<T>(path);

    return result.data;
  } catch {
    return fallback;
  }
}
