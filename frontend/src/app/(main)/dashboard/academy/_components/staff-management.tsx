import { format } from "date-fns";
import { Calculator, UserPlus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

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
            <Input type="date" name="from" defaultValue={from} />
            <Input type="date" name="to" defaultValue={today} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="dry_run" />
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
      <Input name="name" defaultValue={employee?.name ?? ""} placeholder={t("name")} required />
      <Input name="phone" defaultValue={employee?.phone ?? ""} placeholder={t("phone")} />
      <NativeSelect name="role" defaultValue={employee?.role ?? "employee"} className="w-full">
        <option value="employee">{t("roles.employee")}</option>
        <option value="captain">{t("roles.captain")}</option>
        <option value="manager">{t("roles.manager")}</option>
      </NativeSelect>
      <Input name="base_salary" type="number" min="0" step="0.01" defaultValue={employee?.base_salary ?? "0"} />
      <Input
        name="commission_rate"
        type="number"
        min="0"
        max="9.9999"
        step="0.0001"
        defaultValue={employee?.commission_rate ?? "0"}
      />
      <NativeSelect
        name="shift_id"
        defaultValue={employee?.shift?.id ? String(employee.shift.id) : ""}
        className="w-full"
      >
        <option value="">{t("noShift")}</option>
        {shifts.map((shift) => (
          <option key={shift.id} value={shift.id}>
            {shift.name}
          </option>
        ))}
      </NativeSelect>
      <Input name="hire_date" type="date" defaultValue="" />
      <NativeSelect name="status" defaultValue={employee?.status ?? "active"} className="w-full">
        <option value="active">{t("active")}</option>
        <option value="inactive">{t("inactive")}</option>
      </NativeSelect>
      <Input name="user_id" type="number" min="1" placeholder={t("userId")} />
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
