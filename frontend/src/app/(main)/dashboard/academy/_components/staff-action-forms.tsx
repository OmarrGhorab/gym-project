"use client";

import * as React from "react";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field";
import { FormDatePicker, FormSelect } from "@/components/ui/form-controls";
import { Label } from "@/components/ui/label";

import { type AcademyActionResult, backfillCommissions, deleteEmployee, saveEmployee } from "./actions";
import type { AcademyEmployee } from "./data";
import { StaffQrDialog } from "./employee-performance-table";

type ShiftOption = {
  id: number;
  name: string;
};

type UserOption = {
  id: number;
  name: string;
  email: string;
  roles: string[];
};

const employeeRoleOptions = [
  { label: "Employee", value: "employee" },
  { label: "Captain", value: "captain" },
  { label: "Manager", value: "manager" },
  { label: "Coach", value: "coach" },
] as const;

export type EmployeeActionPermissions = {
  canCreate: boolean;
  canDelete: boolean;
  canUpdate: boolean;
};

export function EmployeeActionForm({
  employee,
  permissions,
  shifts,
  users,
}: {
  employee?: AcademyEmployee;
  permissions: EmployeeActionPermissions;
  shifts: ShiftOption[];
  users: UserOption[];
}) {
  const t = useTranslations("Dashboard.academy");
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<AcademyActionResult["errors"]>({});
  const isNew = !employee;
  const canSubmit = isNew ? permissions.canCreate : permissions.canUpdate;
  const canDelete = !isNew && permissions.canDelete;
  const readOnly = !canSubmit;
  const shiftOptions = mergeCurrentShiftOption(shifts, employee?.shift);
  const showShiftSelect = shiftOptions.length > 0;
  const showUserSelect = users.length > 0;

  function handleResult(result: AcademyActionResult) {
    setErrors(result.errors ?? {});

    if (result.ok) {
      toast.success(result.message);
      return;
    }

    toast.error(result.message);
  }

  function submit(formData: FormData) {
    if (!canSubmit) {
      return;
    }

    startTransition(async () => handleResult(await saveEmployee(formData)));
  }

  function remove(formData: FormData) {
    if (!canDelete) {
      return;
    }

    startTransition(async () => handleResult(await deleteEmployee(formData)));
  }

  return (
    <div className="grid gap-4">
      <form
        action={submit}
        id={employee ? `employee-${employee.id}` : undefined}
        className="grid grid-cols-1 gap-2 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
      >
        <input type="hidden" name="id" value={employee?.id ?? 0} />
        <FormField error={errors?.name?.[0]} label={t("name")} name="employee-name">
          <input
            id="employee-name"
            name="name"
            defaultValue={employee?.name ?? ""}
            placeholder={t("name")}
            required
            disabled={readOnly}
            aria-invalid={Boolean(errors?.name?.[0])}
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </FormField>
        <FormField error={errors?.phone?.[0]} label={t("phone")} name="employee-phone">
          <input
            id="employee-phone"
            name="phone"
            defaultValue={employee?.phone ?? ""}
            placeholder={t("phone")}
            disabled={readOnly}
            aria-invalid={Boolean(errors?.phone?.[0])}
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </FormField>
        <FormField label={t("role")}>
          <FormSelect
            name="role"
            defaultValue={employee?.role ?? "employee"}
            placeholder={t("role")}
            error={errors?.role?.[0]}
            disabled={readOnly}
            options={[...employeeRoleOptions]}
          />
        </FormField>
        <FormField error={errors?.base_salary?.[0]} label={t("baseSalary")} name="employee-base-salary">
          <input
            id="employee-base-salary"
            name="base_salary"
            type="number"
            min="0"
            step="0.01"
            defaultValue={employee?.base_salary ?? "0"}
            disabled={readOnly}
            aria-invalid={Boolean(errors?.base_salary?.[0])}
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </FormField>
        <FormField error={errors?.pay_day?.[0]} label={t("payDay")} name="employee-pay-day">
          <input
            id="employee-pay-day"
            name="pay_day"
            type="number"
            min="1"
            max="31"
            defaultValue={employee?.pay_day ?? ""}
            placeholder={t("payDayPlaceholder")}
            disabled={readOnly}
            aria-invalid={Boolean(errors?.pay_day?.[0])}
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </FormField>
        {showShiftSelect ? (
          <FormField label={t("shift")}>
            <FormSelect
              name="shift_id"
              defaultValue={employee?.shift?.id ? String(employee.shift.id) : ""}
              placeholder={t("noShift")}
              error={errors?.shift_id?.[0]}
              disabled={readOnly}
              options={shiftOptions.map((shift) => ({ value: String(shift.id), label: shift.name }))}
            />
          </FormField>
        ) : null}
        <FormField label={t("hireDate")}>
          <FormDatePicker
            name="hire_date"
            defaultValue={employee?.hire_date ?? ""}
            error={errors?.hire_date?.[0]}
            disabled={readOnly}
          />
        </FormField>
        <FormField label={t("status")}>
          <FormSelect
            name="status"
            defaultValue={employee?.status ?? "active"}
            error={errors?.status?.[0]}
            disabled={readOnly}
            options={[
              { value: "active", label: t("active") },
              { value: "inactive", label: t("inactive") },
            ]}
          />
        </FormField>
        {showUserSelect ? (
          <FormField label={t("userId")} className="sm:col-span-2 lg:col-span-1">
            <FormSelect
              name="user_id"
              defaultValue={employee?.user_id ? String(employee.user_id) : ""}
              placeholder={t("unlinkedUser")}
              error={errors?.user_id?.[0]}
              disabled={readOnly}
              options={users.map((user) => ({
                value: String(user.id),
                label: `${user.name} (${user.email})${user.roles.length > 0 ? ` - ${user.roles.join(", ")}` : ""}`,
              }))}
            />
          </FormField>
        ) : null}

        {canSubmit || canDelete || employee ? (
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-6">
            {canSubmit ? (
              <Button type="submit" size="sm" disabled={pending}>
                {isNew ? t("create") : t("save")}
              </Button>
            ) : null}
            {canDelete ? (
              <Button formAction={remove} type="submit" size="sm" variant="outline" disabled={pending}>
                {t("delete")}
              </Button>
            ) : null}
            {employee ? (
              <StaffQrDialog
                employeeName={employee.name}
                payload={
                  employee.attendance_qr ?? (employee.attendance_code ? `employee:${employee.attendance_code}` : null)
                }
              />
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}

export function CommissionBackfillForm({ from, today }: { from: string; today: string }) {
  const t = useTranslations("Dashboard.academy");
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<AcademyActionResult["errors"]>({});

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await backfillCommissions(formData);
      setErrors(result.errors ?? {});

      if (result.ok) {
        toast.success(result.message);
        return;
      }

      toast.error(result.message);
    });
  }

  return (
    <form action={submit} className="grid gap-3">
      <FormField label={t("fromDate")}>
        <FormDatePicker name="from" defaultValue={from} error={errors?.from?.[0]} />
      </FormField>
      <FormField label={t("toDate")}>
        <FormDatePicker name="to" defaultValue={today} error={errors?.to?.[0]} />
      </FormField>
      <div className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted">
        <Checkbox id="commission-dry-run" name="dry_run" />
        <Label htmlFor="commission-dry-run">{t("dryRun")}</Label>
      </div>
      <Button type="submit" disabled={pending}>
        {t("backfillCommissions")}
      </Button>
    </form>
  );
}

function FormField({
  children,
  className,
  error,
  label,
  name,
}: {
  children: React.ReactNode;
  className?: string;
  error?: string;
  label: string;
  name?: string;
}) {
  return (
    <div className={`grid min-w-0 gap-1 ${className ?? ""}`}>
      <Label className="font-medium text-muted-foreground text-xs" htmlFor={name}>
        {label}
      </Label>
      {children}
      <FieldError errors={error ? [error] : undefined} />
    </div>
  );
}

function mergeCurrentShiftOption(shifts: ShiftOption[], currentShift: AcademyEmployee["shift"] | undefined) {
  if (!currentShift || shifts.some((shift) => shift.id === currentShift.id)) {
    return shifts;
  }

  return [...shifts, currentShift];
}
