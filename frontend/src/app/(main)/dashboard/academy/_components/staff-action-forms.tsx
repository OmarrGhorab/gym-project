"use client";

import * as React from "react";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field";
import { FormDatePicker, FormSelect } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  type AcademyActionResult,
  backfillCommissions,
  deleteEmployee,
  deleteEmployeePlanCommissionRule,
  saveEmployee,
  saveEmployeePlanCommissionRule,
} from "./actions";
import type { AcademyEmployee, AcademyEmployeePlanCommissionRule, AccessRole } from "./data";

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
  plans,
  roles,
  shifts,
  users,
}: {
  employee?: AcademyEmployee;
  plans: {
    id: number;
    name: string;
    price: string;
  }[];
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
    <div className="grid gap-4">
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
            options={roles.map((role) => ({ value: role.name, label: role.name }))}
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
        <FormField error={errors?.pay_day?.[0]} label={t("payDay")} name="employee-pay-day">
          <input
            id="employee-pay-day"
            name="pay_day"
            type="number"
            min="1"
            max="31"
            defaultValue={employee?.pay_day ?? ""}
            placeholder={t("payDayPlaceholder")}
            aria-invalid={Boolean(errors?.pay_day?.[0])}
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

      {employee ? <CoachCommissionRulesSection employee={employee} plans={plans} /> : null}
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

function CoachCommissionRulesSection({
  employee,
  plans,
}: {
  employee: AcademyEmployee;
  plans: {
    id: number;
    name: string;
    price: string;
  }[];
}) {
  const t = useTranslations("Dashboard.academy");

  return (
    <div className="grid gap-3 rounded-lg border border-dashed p-3">
      <div className="space-y-1">
        <p className="font-medium text-sm">{t("coachCommissionRules")}</p>
        <p className="text-muted-foreground text-xs">{t("coachCommissionRulesDescription")}</p>
      </div>
      <CoachCommissionRuleForm employeeId={employee.id} plans={plans} />
      {(employee.plan_commission_rules ?? []).map((rule) => (
        <CoachCommissionRuleForm key={rule.id} employeeId={employee.id} plans={plans} rule={rule} />
      ))}
    </div>
  );
}

function CoachCommissionRuleForm({
  employeeId,
  plans,
  rule,
}: {
  employeeId: number;
  plans: {
    id: number;
    name: string;
    price: string;
  }[];
  rule?: AcademyEmployeePlanCommissionRule;
}) {
  const t = useTranslations("Dashboard.academy");
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<AcademyActionResult["errors"]>({});
  const isNew = !rule;
  const [calculationType, setCalculationType] = React.useState<"fixed" | "percentage">(
    rule?.calculation_type ?? "fixed",
  );
  const [isActive, setIsActive] = React.useState(rule?.is_active ?? true);

  function handleResult(result: AcademyActionResult) {
    setErrors(result.errors ?? {});

    if (result.ok) {
      toast.success(result.message);
      return;
    }

    toast.error(result.message);
  }

  function submit(formData: FormData) {
    startTransition(async () => handleResult(await saveEmployeePlanCommissionRule(formData)));
  }

  function remove(formData: FormData) {
    startTransition(async () => handleResult(await deleteEmployeePlanCommissionRule(formData)));
  }

  return (
    <form action={submit} className="grid gap-2 rounded-lg border p-3 md:grid-cols-2 xl:grid-cols-5">
      <input type="hidden" name="employee_id" value={employeeId} />
      <input type="hidden" name="id" value={rule?.id ?? 0} />

      <FormField label={t("commissionPlan")}>
        <FormSelect
          name="plan_id"
          defaultValue={rule?.plan_id ? String(rule.plan_id) : ""}
          error={errors?.plan_id?.[0]}
          options={[
            { value: "", label: t("allPlansDefault") },
            ...plans.map((plan) => ({
              value: String(plan.id),
              label: `${plan.name} - ${plan.price} EGP`,
            })),
          ]}
        />
      </FormField>

      <FormField label={t("commissionType")}>
        <FormSelect
          name="calculation_type"
          defaultValue={calculationType}
          onValueChange={(value) => setCalculationType((value as "fixed" | "percentage") || "fixed")}
          error={errors?.calculation_type?.[0]}
          options={[
            { value: "fixed", label: t("fixedCommission") },
            { value: "percentage", label: t("percentageCommission") },
          ]}
        />
      </FormField>

      <FormField
        label={calculationType === "percentage" ? t("commissionPercentage") : t("commissionValue")}
        error={errors?.value?.[0]}
      >
        <Input name="value" type="number" min="0" step="0.01" defaultValue={rule?.value ?? "0"} />
      </FormField>

      <div className="grid gap-1">
        <Label className="font-medium text-muted-foreground text-xs">{t("status")}</Label>
        <div className="flex h-9 items-center gap-2 rounded-lg border border-input px-3">
          <input type="hidden" name="is_active" value={isActive ? "on" : ""} />
          <Checkbox
            id={`coach-rule-active-${rule?.id ?? "new"}`}
            checked={isActive}
            onCheckedChange={(checked) => setIsActive(checked === true)}
          />
          <span className="text-sm">{isActive ? t("active") : t("inactive")}</span>
        </div>
        <FieldError errors={errors?.is_active} />
      </div>

      <div className="flex items-end gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {isNew ? t("addRule") : t("saveRule")}
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
