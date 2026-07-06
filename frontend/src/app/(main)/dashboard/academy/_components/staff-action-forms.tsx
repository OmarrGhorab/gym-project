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

export function EmployeeActionForm({
  employee,
  roles,
  shifts,
  users,
}: {
  employee?: AcademyEmployee;
  roles: AccessRole[];
  shifts: ShiftOption[];
  users: UserOption[];
}) {
  const t = useTranslations("Dashboard.academy");
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<AcademyActionResult["errors"]>({});
  const isNew = !employee;

  function handleResult(result: AcademyActionResult) {
    setErrors(result.errors ?? {});

    if (result.ok) {
      toast.success(result.message);
      return;
    }

    toast.error(result.message);
  }

  function submit(formData: FormData) {
    startTransition(async () => handleResult(await saveEmployee(formData)));
  }

  function remove(formData: FormData) {
    startTransition(async () => handleResult(await deleteEmployee(formData)));
  }

  return (
    <form
      action={submit}
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
          options={roles.map((role) => ({
            value: role.name,
            label: role.name,
          }))}
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
          aria-invalid={Boolean(errors?.base_salary?.[0])}
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </FormField>
      <FormField error={errors?.commission_rate?.[0]} label={t("commissionRate")} name="employee-commission-rate">
        <input
          id="employee-commission-rate"
          name="commission_rate"
          type="number"
          min="0"
          max="9.9999"
          step="0.0001"
          defaultValue={employee?.commission_rate ?? "0"}
          aria-invalid={Boolean(errors?.commission_rate?.[0])}
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
      </FormField>
      <FormField label={t("shift")}>
        <FormSelect
          name="shift_id"
          defaultValue={employee?.shift?.id ? String(employee.shift.id) : ""}
          placeholder={t("noShift")}
          error={errors?.shift_id?.[0]}
          options={shifts.map((shift) => ({ value: String(shift.id), label: shift.name }))}
        />
      </FormField>
      <FormField label={t("hireDate")}>
        <FormDatePicker name="hire_date" defaultValue={employee?.hire_date ?? ""} error={errors?.hire_date?.[0]} />
      </FormField>
      <FormField label={t("status")}>
        <FormSelect
          name="status"
          defaultValue={employee?.status ?? "active"}
          error={errors?.status?.[0]}
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
          error={errors?.user_id?.[0]}
          options={users.map((user) => ({
            value: String(user.id),
            label: `${user.name} (${user.email})${user.roles.length > 0 ? ` - ${user.roles.join(", ")}` : ""}`,
          }))}
        />
      </FormField>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-3 xl:col-span-6">
        <Button type="submit" size="sm" disabled={pending}>
          {isNew ? t("create") : t("save")}
        </Button>
        {!isNew ? (
          <Button formAction={remove} type="submit" size="sm" variant="outline" disabled={pending}>
            {t("delete")}
          </Button>
        ) : null}
      </div>
    </form>
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
