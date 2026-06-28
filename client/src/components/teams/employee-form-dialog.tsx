"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { createEmployee, updateEmployee, type EmployeeFormData } from "@/lib/actions/employees";
import type { Employee, EmployeeShift } from "@/lib/api/dashboard";
import type { AppLocale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type EmployeeFormState = {
  name: string;
  phone: string;
  role: "employee" | "captain" | "manager";
  base_salary: string;
  commission_rate: string;
  shift_id: string;
  hire_date: string;
  status: "active" | "inactive";
};

type EmployeeFormDialogProps = {
  mode: "add" | "edit";
  employee: Employee | null;
  shifts?: EmployeeShift[];
  namespace?: "TeamsPage" | "TrainersPage";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

const emptyForm: EmployeeFormState = {
  name: "",
  phone: "",
  role: "employee",
  base_salary: "0",
  commission_rate: "0",
  shift_id: "__none__",
  hire_date: "",
  status: "active",
};

export function EmployeeFormDialog({
  mode,
  employee,
  shifts = [],
  namespace = "TeamsPage",
  open,
  onOpenChange,
  onSuccess,
}: EmployeeFormDialogProps) {
  const initialForm = React.useMemo(
    () => getInitialForm(mode, employee, namespace),
    [employee, mode, namespace]
  );

  return (
    <EmployeeFormDialogContent
      key={`${mode}-${employee?.id ?? "new"}-${namespace}`}
      mode={mode}
      employee={employee}
      shifts={shifts}
      namespace={namespace}
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
      initialForm={initialForm}
    />
  );
}

function EmployeeFormDialogContent({
  mode,
  employee,
  shifts = [],
  namespace,
  open,
  onOpenChange,
  onSuccess,
  initialForm,
}: EmployeeFormDialogProps & { initialForm: EmployeeFormState }) {
  const locale = useLocale();
  const t = useTranslations(namespace);
  const [form, setForm] = React.useState<EmployeeFormState>(initialForm);
  const [isPending, startTransition] = React.useTransition();

  function updateForm<K extends keyof EmployeeFormState>(key: K, value: EmployeeFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validation = validateEmployeeForm(form, t);
    if (validation) {
      toast.error(validation);
      return;
    }

    const payload: EmployeeFormData = {
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      role: form.role,
      base_salary: form.base_salary || "0",
      commission_rate: form.commission_rate || "0",
      shift_id: form.shift_id === "__none__" ? null : Number(form.shift_id),
      hire_date: form.hire_date || null,
      status: form.status,
    };

    startTransition(async () => {
      try {
        if (mode === "edit" && employee) {
          await updateEmployee(employee.id, payload, locale as AppLocale);
          toast.success(t("employeeUpdatedSuccess"));
        } else {
          await createEmployee(payload, locale as AppLocale);
          toast.success(t("employeeCreatedSuccess"));
        }
        onOpenChange(false);
        onSuccess?.();
      } catch (err) {
        toast.error(parseActionError(err, t("formError")));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? t("editEmployeeTitle") : t("addEmployeeTitle")}</DialogTitle>
          <DialogDescription>
            {mode === "edit" ? t("editEmployeeDescription") : t("addEmployeeDescription")}
          </DialogDescription>
        </DialogHeader>

        <form id="employee-form" onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <Field label={t("formName")} htmlFor="employee-name" className="sm:col-span-2">
            <Input
              id="employee-name"
              value={form.name}
              onChange={(event) => updateForm("name", event.target.value)}
              disabled={isPending}
              required
            />
          </Field>
          <Field label={t("formPhone")} htmlFor="employee-phone">
            <Input
              id="employee-phone"
              value={form.phone}
              onChange={(event) => updateForm("phone", event.target.value)}
              disabled={isPending}
            />
          </Field>
          <Field label={t("formRole")} htmlFor="employee-role">
            <Select
              value={form.role}
              onValueChange={(value) => updateForm("role", normalizeRole(value))}
              disabled={isPending}
            >
              <SelectTrigger id="employee-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="employee">{t("roleEmployee")}</SelectItem>
                <SelectItem value="captain">{t("roleCaptain")}</SelectItem>
                <SelectItem value="manager">{t("roleManager")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("formSalary")} htmlFor="employee-salary">
            <Input
              id="employee-salary"
              inputMode="decimal"
              value={form.base_salary}
              onChange={(event) => updateForm("base_salary", event.target.value)}
              disabled={isPending}
            />
          </Field>
          <Field label={t("formCommission")} htmlFor="employee-commission">
            <Input
              id="employee-commission"
              inputMode="decimal"
              value={form.commission_rate}
              onChange={(event) => updateForm("commission_rate", event.target.value)}
              disabled={isPending}
            />
          </Field>
          <Field label={t("formShift")} htmlFor="employee-shift">
            <Select
              value={form.shift_id}
              onValueChange={(value) => updateForm("shift_id", value || "__none__")}
              disabled={isPending}
            >
              <SelectTrigger id="employee-shift" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("formShiftNone")}</SelectItem>
                {shifts.map((shift) => (
                  <SelectItem key={shift.id} value={String(shift.id)}>
                    {shift.name} · {shift.starts_at}-{shift.ends_at}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("formHireDate")} htmlFor="employee-hire-date">
            <Input
              id="employee-hire-date"
              type="date"
              value={form.hire_date}
              onChange={(event) => updateForm("hire_date", event.target.value)}
              disabled={isPending}
            />
          </Field>
          <Field label={t("formStatus")} htmlFor="employee-status">
            <Select
              value={form.status}
              onValueChange={(value) => updateForm("status", value === "inactive" ? "inactive" : "active")}
              disabled={isPending}
            >
              <SelectTrigger id="employee-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("statusActive")}</SelectItem>
                <SelectItem value="inactive">{t("statusInactive")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("formCancel")}
          </Button>
          <Button type="submit" form="employee-form" disabled={isPending}>
            {mode === "edit" ? t("formSave") : t("formAdd")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-2 block text-xs font-bold">
        {label}
      </Label>
      {children}
    </div>
  );
}

function validateEmployeeForm(form: EmployeeFormState, t: (key: string) => string) {
  if (form.name.trim().length < 2) return t("nameValidation");
  if (form.phone && form.phone.trim().length > 30) return t("phoneValidation");
  if (!["employee", "captain", "manager"].includes(form.role)) return t("roleValidation");
  if (!isNonNegativeDecimal(form.base_salary)) return t("salaryValidation");
  if (!isNonNegativeDecimal(form.commission_rate)) return t("commissionValidation");
  return null;
}

function isNonNegativeDecimal(value: string) {
  if (value.trim() === "") return true;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0;
}

function normalizeRole(value: string | null): EmployeeFormState["role"] {
  if (value === "captain" || value === "manager") return value;
  return "employee";
}

function getInitialForm(
  mode: "add" | "edit",
  employee: Employee | null,
  namespace: "TeamsPage" | "TrainersPage" = "TeamsPage"
): EmployeeFormState {
  if (mode === "edit" && employee) {
    return {
      name: employee.name,
      phone: employee.phone ?? "",
      role: normalizeRole(employee.role),
      base_salary: employee.base_salary ?? "0",
      commission_rate: employee.commission_rate ?? "0",
      shift_id: employee.shift_id ? String(employee.shift_id) : "__none__",
      hire_date: employee.hire_date ?? "",
      status: employee.status === "inactive" ? "inactive" : "active",
    };
  }

  return {
    ...emptyForm,
    role: namespace === "TrainersPage" ? "captain" : "employee",
  };
}

function parseActionError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;

  try {
    const parsed = JSON.parse(error.message) as { message?: string };
    return parsed.message ?? fallback;
  } catch {
    return error.message || fallback;
  }
}
