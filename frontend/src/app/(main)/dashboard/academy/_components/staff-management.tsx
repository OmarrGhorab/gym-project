import { format } from "date-fns";
import { Calculator, UserPlus } from "lucide-react";
import type * as React from "react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormDatePicker, FormSelect } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";

import { backfillCommissions, deleteEmployee, saveEmployee } from "./actions";
import type { AcademyEmployee } from "./data";

type ShiftOption = {
  id: number;
  name: string;
  starts_at: string;
  ends_at: string;
};

export async function StaffManagement({ employees, shifts }: { employees: AcademyEmployee[]; shifts: ShiftOption[] }) {
  const t = await getTranslations("Dashboard.academy");
  const today = format(new Date(), "yyyy-MM-dd");
  const from = format(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-7">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-normal">
            <UserPlus className="size-4" />
            {t("staffManagement")}
          </CardTitle>
          <CardDescription>{t("staffManagementDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <EmployeeForm shifts={shifts} />
          {employees.map((employee) => (
            <EmployeeForm key={employee.id} employee={employee} shifts={shifts} />
          ))}
        </CardContent>
      </Card>

      <Card className="xl:col-span-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-normal">
            <Calculator className="size-4" />
            {t("commissionBackfill")}
          </CardTitle>
          <CardDescription>{t("commissionBackfillDescription")}</CardDescription>
        </CardHeader>
      <CardContent>
          <form action={backfillCommissions} className="grid gap-3">
            <FormField label={t("fromDate")}>
              <FormDatePicker name="from" defaultValue={from} />
            </FormField>
            <FormField label={t("toDate")}>
              <FormDatePicker name="to" defaultValue={today} />
            </FormField>
            <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted">
              <Checkbox name="dry_run" />
              {t("dryRun")}
            </label>
            <Button type="submit">{t("backfillCommissions")}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

async function EmployeeForm({ employee, shifts }: { employee?: AcademyEmployee; shifts: ShiftOption[] }) {
  const t = await getTranslations("Dashboard.academy");
  const isNew = !employee;

  return (
    <form action={saveEmployee} className="grid gap-2 rounded-lg border p-3 md:grid-cols-6">
      <input type="hidden" name="id" value={employee?.id ?? 0} />
      <FormField label={t("name")}>
        <Input name="name" defaultValue={employee?.name ?? ""} placeholder={t("name")} required />
      </FormField>
      <FormField label={t("phone")}>
        <Input name="phone" defaultValue={employee?.phone ?? ""} placeholder={t("phone")} />
      </FormField>
      <FormField label={t("role")}>
        <FormSelect
          name="role"
          defaultValue={employee?.role ?? "employee"}
          options={[
            { value: "employee", label: t("roles.employee") },
            { value: "captain", label: t("roles.captain") },
            { value: "manager", label: t("roles.manager") },
          ]}
        />
      </FormField>
      <FormField label={t("baseSalary")}>
        <Input name="base_salary" type="number" min="0" step="0.01" defaultValue={employee?.base_salary ?? "0"} />
      </FormField>
      <FormField label={t("commissionRate")}>
        <Input
          name="commission_rate"
          type="number"
          min="0"
          max="9.9999"
          step="0.0001"
          defaultValue={employee?.commission_rate ?? "0"}
        />
      </FormField>
      <FormField label={t("shift")}>
        <FormSelect
          name="shift_id"
          defaultValue={employee?.shift?.id ? String(employee.shift.id) : ""}
          placeholder={t("noShift")}
          options={shifts.map((shift) => ({ value: String(shift.id), label: shift.name }))}
        />
      </FormField>
      <FormField label={t("hireDate")}>
        <FormDatePicker name="hire_date" defaultValue={employee?.hire_date ?? ""} />
      </FormField>
      <FormField label={t("status")}>
        <FormSelect
          name="status"
          defaultValue={employee?.status ?? "active"}
          options={[
            { value: "active", label: t("active") },
            { value: "inactive", label: t("inactive") },
          ]}
        />
      </FormField>
      <FormField label={t("userId")}>
        <Input name="user_id" type="number" min="1" placeholder={t("userId")} />
      </FormField>
      <div className="flex gap-2 md:col-span-3">
        <Button type="submit" size="sm">
          {isNew ? t("create") : t("save")}
        </Button>
        {!isNew ? (
          <Button formAction={deleteEmployee} type="submit" size="sm" variant="outline">
            {t("delete")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function FormField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="grid min-w-0 gap-1">
      <div className="text-muted-foreground text-xs font-medium">{label}</div>
      {children}
    </div>
  );
}
