import type * as React from "react";

import { format } from "date-fns";
import { Calculator, UserPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormDatePicker, FormSelect } from "@/components/ui/form-controls";
import { Label } from "@/components/ui/label";

import { backfillCommissions, deleteEmployee, saveEmployee } from "./actions";
import type { AcademyEmployee, AccessRole } from "./data";

type ShiftOption = {
  id: number;
  name: string;
  starts_at: string;
  ends_at: string;
};

type UserOption = {
  id: number;
  name: string;
  email: string;
  roles: string[];
};

export async function StaffManagement({
  employees,
  shifts,
  users,
  roles,
}: {
  employees: AcademyEmployee[];
  shifts: ShiftOption[];
  users: UserOption[];
  roles: AccessRole[];
}) {
  const t = await getTranslations("Dashboard.academy");
  const today = format(new Date(), "yyyy-MM-dd");
  const from = format(new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");

  return (
    <div className="flex flex-col gap-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-normal">
            <UserPlus className="size-4" />
            {t("staffManagement")}
          </CardTitle>
          <CardDescription>{t("staffManagementDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <EmployeeForm shifts={shifts} users={users} roles={roles} />
          {employees.map((employee) => (
            <EmployeeForm key={employee.id} employee={employee} shifts={shifts} users={users} roles={roles} />
          ))}
        </CardContent>
      </Card>

      <Card className="w-full">
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
            <div className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted">
              <Checkbox id="commission-dry-run" name="dry_run" />
              <Label htmlFor="commission-dry-run">{t("dryRun")}</Label>
            </div>
            <Button type="submit">{t("backfillCommissions")}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

async function EmployeeForm({
  employee,
  shifts,
  users,
  roles,
}: {
  employee?: AcademyEmployee;
  shifts: ShiftOption[];
  users: UserOption[];
  roles: AccessRole[];
}) {
  const t = await getTranslations("Dashboard.academy");
  const isNew = !employee;

  return (
    <form
      action={saveEmployee}
      className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
    >
      <input type="hidden" name="id" value={employee?.id ?? 0} />
      <FormField label={t("name")}>
        <input
          name="name"
          defaultValue={employee?.name ?? ""}
          placeholder={t("name")}
          required
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </FormField>
      <FormField label={t("phone")}>
        <input
          name="phone"
          defaultValue={employee?.phone ?? ""}
          placeholder={t("phone")}
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </FormField>
      <FormField label={t("role")}>
        <FormSelect
          name="role"
          defaultValue={employee?.role ?? "employee"}
          placeholder={t("role")}
          options={roles.map((role) => ({
            value: role.name,
            label: role.name,
          }))}
        />
      </FormField>
      <FormField label={t("baseSalary")}>
        <input
          name="base_salary"
          type="number"
          min="0"
          step="0.01"
          defaultValue={employee?.base_salary ?? "0"}
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </FormField>
      <FormField label={t("commissionRate")}>
        <input
          name="commission_rate"
          type="number"
          min="0"
          max="9.9999"
          step="0.0001"
          defaultValue={employee?.commission_rate ?? "0"}
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
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
      <FormField label={t("userId")} className="sm:col-span-2 lg:col-span-1">
        <FormSelect
          name="user_id"
          defaultValue={employee?.user_id ? String(employee.user_id) : ""}
          placeholder={t("unlinkedUser")}
          options={users.map((user) => ({
            value: String(user.id),
            label: `${user.name} (${user.email})${user.roles.length > 0 ? ` - ${user.roles.join(", ")}` : ""}`,
          }))}
        />
      </FormField>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-6">
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

function FormField({ children, label, className }: { children: React.ReactNode; label: string; className?: string }) {
  return (
    <div className={`grid min-w-0 gap-1 ${className ?? ""}`}>
      <div className="font-medium text-muted-foreground text-xs">{label}</div>
      {children}
    </div>
  );
}
