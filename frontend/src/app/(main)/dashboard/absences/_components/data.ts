import { serverApiFetch } from "@/lib/api/server";

export type AbsenceEmployee = {
  id: number;
  name: string;
  role: string;
  status: "active" | "inactive";
  payroll_status: "pending" | "paid" | null;
};

export type EmployeeAbsence = {
  id: number;
  employee: {
    id: number;
    name: string;
    role: string;
    status: "active" | "inactive";
  };
  date: string;
  reason: string | null;
  deduction_amount: string;
  recorded_by: {
    id: number;
    name: string;
  } | null;
  created_at: string | null;
};

export type EmployeeAbsencePageData = {
  month: string;
  employees: AbsenceEmployee[];
  absences: EmployeeAbsence[];
};

export async function getEmployeeAbsencePageData(month: string): Promise<EmployeeAbsencePageData> {
  try {
    const result = await serverApiFetch<EmployeeAbsencePageData>(
      `/employee-absences?month=${encodeURIComponent(month)}`,
    );

    return result.data;
  } catch {
    return {
      month,
      employees: [],
      absences: [],
    };
  }
}
