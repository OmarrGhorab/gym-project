"use client";

import * as React from "react";
import { useActionState } from "react";

import { PackageCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormDatePicker, FormSelect, FormTimePicker } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { createPlan, type PlanFormState, updatePlan } from "./actions";
import type { PlanEmployeeOption, PlanRow } from "./data";

const initialPlanFormState: PlanFormState = {
  ok: false,
  errors: {},
  values: {},
};

type PlanFormProps = {
  employees: PlanEmployeeOption[];
  mode?: "create" | "edit";
  plan?: PlanRow;
};

type PlanEmployeeCommissionDraft = {
  _key: string;
  calculation_type: "fixed" | "percentage";
  employee_id: string;
  id: number;
  is_active: boolean;
  value: string;
};

const planCategoryOptions = ["gym_access", "personal_training", "classes", "nutrition", "recovery"] as const;
const servicePlanCategories = new Set<string>(["personal_training", "classes", "nutrition", "recovery"]);

function isPlanEmployeeCommissionDraft(value: unknown): value is Partial<PlanEmployeeCommissionDraft> {
  return typeof value === "object" && value !== null;
}

function normalizeCommissionType(value: unknown): "fixed" | "percentage" {
  return value === "percentage" ? "percentage" : "fixed";
}

function normalizeEmployeeRule(value: unknown, index: number): PlanEmployeeCommissionDraft | null {
  if (!isPlanEmployeeCommissionDraft(value)) {
    return null;
  }

  const employeeId =
    typeof value.employee_id === "string" || typeof value.employee_id === "number" ? String(value.employee_id) : "";

  return {
    _key:
      typeof value._key === "string" && value._key.length > 0
        ? value._key
        : `parsed-${index}-${typeof value.id === "number" ? value.id : "new"}`,
    calculation_type: normalizeCommissionType(value.calculation_type),
    employee_id: employeeId,
    id: typeof value.id === "number" ? value.id : 0,
    is_active: value.is_active !== false,
    value: typeof value.value === "string" || typeof value.value === "number" ? String(value.value) : "0",
  };
}

export function PlanCreateForm({ employees, mode = "create", plan }: PlanFormProps) {
  const t = useTranslations("Dashboard.plans");
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(mode === "edit" ? updatePlan : createPlan, initialPlanFormState);
  const initialUnlimitedSessions = state.values.is_unlimited_sessions
    ? state.values.is_unlimited_sessions === "on"
    : Boolean(plan?.is_unlimited_sessions);
  const initialFreezeRequiresApproval = state.values.freeze_requires_approval
    ? state.values.freeze_requires_approval === "on"
    : Boolean(plan?.freeze_requires_approval);
  const initialPlanType = state.values.type || valueOrPlan(state, plan, "type") || "membership";
  const initialCategory = state.values.category || valueOrPlan(state, plan, "category") || "gym_access";
  const initialDurationBasis = state.values.duration_basis || (plan?.duration_months ? "months" : "days");
  const initialDurationMonths = state.values.duration_months || valueOrPlan(state, plan, "duration_months") || "1";
  const initialValidFrom = state.values.valid_from || valueOrPlan(state, plan, "valid_from");
  const initialValidTo = state.values.valid_to || valueOrPlan(state, plan, "valid_to");
  const [planType, setPlanType] = React.useState(initialPlanType);
  const [category, setCategory] = React.useState(initialCategory);
  const [unlimitedSessions, setUnlimitedSessions] = React.useState(initialUnlimitedSessions);
  const [freezeRequiresApproval, setFreezeRequiresApproval] = React.useState(initialFreezeRequiresApproval);
  const [durationBasis, setDurationBasis] = React.useState(initialDurationBasis);
  const [durationMonths, setDurationMonths] = React.useState(initialDurationMonths);
  const [validFrom, setValidFrom] = React.useState(initialValidFrom);
  const [validTo, setValidTo] = React.useState(initialValidTo);
  const [planPrice, setPlanPrice] = React.useState(valueOrPlan(state, plan, "price") || "0");
  const initialEmployeeRules = React.useMemo(
    () => readInitialEmployeeRules(state.values.employee_commission_rules, employees, plan?.id),
    [employees, plan?.id, state.values.employee_commission_rules],
  );
  const [employeeRules, setEmployeeRules] = React.useState<PlanEmployeeCommissionDraft[]>(initialEmployeeRules);
  const employeeCommissionTotal = React.useMemo(
    () =>
      employeeRules.reduce((total, rule) => {
        if (!rule.is_active) {
          return total;
        }

        const value = Math.max(0, Number(rule.value || 0));
        const base = Math.max(0, Number(planPrice || 0));

        if (rule.calculation_type === "percentage") {
          return total + base * (Math.min(value, 100) / 100);
        }

        return total + value;
      }, 0),
    [employeeRules, planPrice],
  );
  const planPriceNumber = Math.max(0, Number(planPrice || 0));
  const gymNetBeforeExpenses = Math.max(0, planPriceNumber - employeeCommissionTotal);
  const isServicePlan = servicePlanCategories.has(category);
  const submittedEmployeeRules = isServicePlan ? employeeRules : [];
  const offerDurationDays = calculateInclusiveDays(validFrom, validTo);

  React.useEffect(() => {
    if (state.ok) {
      if (mode === "create") {
        formRef.current?.reset();
        setPlanType("membership");
        setCategory("gym_access");
        setUnlimitedSessions(false);
        setFreezeRequiresApproval(false);
        setDurationBasis("days");
        setDurationMonths("1");
        setValidFrom("");
        setValidTo("");
        setEmployeeRules([]);
        setPlanPrice("0");
      }
    }
  }, [mode, state.ok]);

  React.useEffect(() => {
    if (!state.ok) {
      setFreezeRequiresApproval(
        state.values.freeze_requires_approval
          ? state.values.freeze_requires_approval === "on"
          : Boolean(plan?.freeze_requires_approval),
      );
      setPlanType(state.values.type || valueOrPlan(state, plan, "type") || "membership");
      setCategory(state.values.category || valueOrPlan(state, plan, "category") || "gym_access");
      setDurationBasis(state.values.duration_basis || (plan?.duration_months ? "months" : "days"));
      setDurationMonths(state.values.duration_months || valueOrPlan(state, plan, "duration_months") || "1");
      setValidFrom(state.values.valid_from || valueOrPlan(state, plan, "valid_from"));
      setValidTo(state.values.valid_to || valueOrPlan(state, plan, "valid_to"));
      setEmployeeRules(readInitialEmployeeRules(state.values.employee_commission_rules, employees, plan?.id));
      setPlanPrice(state.values.price || valueOrPlan(state, plan, "price") || "0");
    }
  }, [
    employees,
    plan,
    plan?.duration_months,
    plan?.freeze_requires_approval,
    plan?.id,
    state,
    state.ok,
    state.values.employee_commission_rules,
    state.values.category,
    state.values.duration_basis,
    state.values.duration_months,
    state.values.freeze_requires_approval,
    state.values.price,
    state.values.type,
    state.values.valid_from,
    state.values.valid_to,
  ]);

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      {mode === "edit" && plan ? <input type="hidden" name="id" value={plan.id} /> : null}
      <input type="hidden" name="employee_commission_rules" value={JSON.stringify(submittedEmployeeRules)} />
      <input
        type="hidden"
        name="initial_employee_commission_rule_ids"
        value={JSON.stringify(initialEmployeeRules.map((rule) => rule.id).filter((id) => id > 0))}
      />
      {state.message ? (
        <div
          className={
            state.ok
              ? "rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-600 text-sm"
              : "rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
          }
        >
          {state.ok ? t(mode === "edit" ? "planUpdated" : "planCreated") : state.message}
        </div>
      ) : null}

      <Field
        error={fieldError(state, "name")}
        label={t("name")}
        name="name"
        defaultValue={valueOrPlan(state, plan, "name")}
      />

      <div className="space-y-2">
        <Label htmlFor="type">{t("type")}</Label>
        <FormSelect
          id="type"
          name="type"
          defaultValue={planType}
          onValueChange={(value) => setPlanType(value || "membership")}
          error={fieldError(state, "type")}
          options={[
            { value: "membership", label: t("planTypes.membership") },
            { value: "offer", label: t("planTypes.offer") },
          ]}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">{t("category")}</Label>
        <FormSelect
          id="category"
          name="category"
          value={category}
          onValueChange={(value) => setCategory(value || "gym_access")}
          error={fieldError(state, "category")}
          options={planCategoryOptions.map((value) => ({
            value,
            label: t(`categories.${value}`),
          }))}
        />
      </div>

      <Field
        error={fieldError(state, "price")}
        help={t("basePriceHelp")}
        label={t("basePrice")}
        name="price"
        type="number"
        step="0.01"
        defaultValue={planPrice}
        onChange={(event) => setPlanPrice(event.currentTarget.value)}
      />
      {planType === "offer" ? (
        <>
          <input type="hidden" name="duration_basis" value="days" />
          <input type="hidden" name="duration_months" value="" />
          <input type="hidden" name="duration_days" value={offerDurationDays} />
          <DateField
            error={fieldError(state, "valid_from")}
            label={t("validFrom")}
            name="valid_from"
            onValueChange={setValidFrom}
            placeholder={t("selectDate")}
            defaultValue={validFrom}
          />
          <DateField
            error={fieldError(state, "valid_to")}
            label={t("validTo")}
            name="valid_to"
            onValueChange={setValidTo}
            placeholder={t("selectDate")}
            defaultValue={validTo}
          />
        </>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="duration_basis">{t("durationType")}</Label>
          <FormSelect
            id="duration_basis"
            name="duration_basis"
            defaultValue={durationBasis}
            onValueChange={(value) => setDurationBasis(value)}
            error={fieldError(state, "duration_basis")}
            options={[
              { value: "days", label: t("durationTypeDays") },
              { value: "months", label: t("durationTypeMonths") },
            ]}
          />
        </div>
      )}
      {planType !== "offer" && durationBasis === "months" ? (
        <>
          <input type="hidden" name="valid_from" value="" />
          <input type="hidden" name="valid_to" value="" />
          <input type="hidden" name="duration_days" value={Math.max(1, Number(durationMonths || 1) * 30)} />
          <Field
            error={fieldError(state, "duration_months")}
            help={t("durationMonthsHelp")}
            label={t("durationMonths")}
            name="duration_months"
            onChange={(event) => setDurationMonths(event.currentTarget.value)}
            type="number"
            defaultValue={durationMonths}
          />
        </>
      ) : null}
      {planType !== "offer" && durationBasis === "days" ? (
        <>
          <input type="hidden" name="valid_from" value="" />
          <input type="hidden" name="valid_to" value="" />
          <input type="hidden" name="duration_months" value="" />
          <Field
            error={fieldError(state, "duration_days")}
            label={t("durationDays")}
            name="duration_days"
            type="number"
            defaultValue={valueOrPlan(state, plan, "duration_days") || "30"}
          />
        </>
      ) : null}

      <div className="flex items-center gap-2">
        <input type="hidden" name="is_unlimited_sessions" value={unlimitedSessions ? "on" : ""} />
        <Checkbox
          id="is_unlimited_sessions"
          checked={unlimitedSessions}
          onCheckedChange={(checked) => setUnlimitedSessions(checked === true)}
        />
        <Label htmlFor="is_unlimited_sessions">{t("unlimitedSessions")}</Label>
      </div>

      {!unlimitedSessions ? (
        <Field
          error={fieldError(state, "sessions_count")}
          label={t("sessionsCount")}
          name="sessions_count"
          type="number"
          defaultValue={valueOrPlan(state, plan, "sessions_count")}
        />
      ) : null}

      <Field
        error={fieldError(state, "max_freeze_days")}
        label={t("maxFreezeDays")}
        name="max_freeze_days"
        type="number"
        defaultValue={valueOrPlan(state, plan, "max_freeze_days") || "0"}
      />
      <Field
        error={fieldError(state, "access_grace_days")}
        label={t("accessGraceDays")}
        name="access_grace_days"
        type="number"
        defaultValue={valueOrPlan(state, plan, "access_grace_days") || "0"}
      />
      <Field
        error={fieldError(state, "min_freeze_days")}
        label={t("minFreezeDays")}
        name="min_freeze_days"
        type="number"
        defaultValue={valueOrPlan(state, plan, "min_freeze_days") || "0"}
      />

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <input type="hidden" name="freeze_requires_approval" value={freezeRequiresApproval ? "on" : ""} />
          <Checkbox
            id="freeze_requires_approval"
            checked={freezeRequiresApproval}
            onCheckedChange={(checked) => setFreezeRequiresApproval(checked === true)}
          />
          <Label htmlFor="freeze_requires_approval">{t("freezeRequiresApproval")}</Label>
        </div>
        <p className="text-muted-foreground text-xs">{t("freezeRequiresApprovalHelp")}</p>
      </div>

      <TimeField
        error={fieldError(state, "access_starts_at")}
        label={t("accessStartsAt")}
        name="access_starts_at"
        defaultValue={valueOrPlan(state, plan, "access_starts_at")}
      />
      <TimeField
        error={fieldError(state, "access_ends_at")}
        label={t("accessEndsAt")}
        name="access_ends_at"
        defaultValue={valueOrPlan(state, plan, "access_ends_at")}
      />

      <div className="space-y-2">
        <Label htmlFor="description">{t("descriptionField")}</Label>
        <Textarea id="description" name="description" defaultValue={valueOrPlan(state, plan, "description")} />
      </div>

      {isServicePlan ? (
        <PlanEmployeesSection
          employees={employees}
          rules={employeeRules}
          setRules={setEmployeeRules}
          title={t("serviceCoaches")}
          description={t("serviceCoachesDescription")}
          addLabel={t("addServiceCoach")}
          employeeLabel={t("employee")}
          commissionTypeLabel={t("commissionType")}
          commissionValueLabel={t("commissionValue")}
          fixedLabel={t("fixedCommission")}
          percentLabel={t("percentageCommission")}
          activeLabel={t("active")}
          deleteLabel={t("delete")}
        />
      ) : (
        <div className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm">
          {t("basePlanCommissionHelp")}
        </div>
      )}

      <div className="grid gap-2 rounded-lg border bg-muted/20 p-4 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">{t("summaryMemberPays")}</span>
          <span className="font-medium tabular-nums">{formatMoney(planPrice)}</span>
        </div>
        {isServicePlan ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">{t("summaryCoachCommission")}</span>
              <span className="font-medium tabular-nums">{formatMoney(employeeCommissionTotal.toFixed(2))}</span>
            </div>
            <div className="flex items-center justify-between gap-3 border-t pt-2">
              <span className="font-medium">{t("summaryGymNet")}</span>
              <span className="font-semibold tabular-nums">{formatMoney(gymNetBeforeExpenses.toFixed(2))}</span>
            </div>
          </>
        ) : null}
      </div>

      <Button type="submit" disabled={pending}>
        <PackageCheck />
        {pending ? t("saving") : t(mode === "edit" ? "savePlan" : "createPlan")}
      </Button>
    </form>
  );
}

function calculateInclusiveDays(start: string, end: string): number {
  if (!start || !end) {
    return 1;
  }

  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const diffMs = endDate.getTime() - startDate.getTime();

  if (!Number.isFinite(diffMs) || diffMs < 0) {
    return 1;
  }

  return Math.max(1, Math.floor(diffMs / 86_400_000) + 1);
}

function valueOrPlan(state: PlanFormState, plan: PlanRow | undefined, key: keyof PlanRow): string {
  const stateValue = state.values[String(key)];

  if (stateValue !== undefined) {
    return stateValue;
  }

  const planValue = plan?.[key];

  if (planValue === null || planValue === undefined) {
    return "";
  }

  return String(planValue);
}

function fieldError(state: PlanFormState, name: string) {
  return state.errors[name]?.[0];
}

function formatMoney(value: string) {
  const number = Number(value || 0);

  if (!Number.isFinite(number)) {
    return "EGP 0.00";
  }

  return `EGP ${number.toFixed(2)}`;
}

function Field({
  defaultValue = "",
  error,
  help,
  label,
  name,
  onChange,
  step,
  type = "text",
}: {
  defaultValue?: string;
  error?: string;
  help?: string;
  label: string;
  name: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  step?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type={type}
        step={step}
        defaultValue={defaultValue}
        aria-invalid={Boolean(error)}
        onChange={onChange}
      />
      {help ? <p className="text-muted-foreground text-xs">{help}</p> : null}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

function DateField({
  defaultValue,
  error,
  label,
  name,
  onValueChange,
  placeholder,
}: {
  defaultValue?: string;
  error?: string;
  label: string;
  name: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <FormDatePicker
        id={name}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        onValueChange={onValueChange}
        error={error}
      />
    </div>
  );
}

function TimeField({
  defaultValue,
  error,
  label,
  name,
}: {
  defaultValue?: string;
  error?: string;
  label: string;
  name: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <FormTimePicker id={name} name={name} defaultValue={defaultValue} error={error} />
    </div>
  );
}

function readInitialEmployeeRules(
  stateValue: string | undefined,
  employees: PlanEmployeeOption[],
  planId?: number,
): PlanEmployeeCommissionDraft[] {
  if (stateValue) {
    try {
      const parsed = JSON.parse(stateValue) as unknown;

      return Array.isArray(parsed)
        ? parsed
            .map((rule, index) => normalizeEmployeeRule(rule, index))
            .filter((rule): rule is PlanEmployeeCommissionDraft => rule !== null)
        : [];
    } catch {
      return [];
    }
  }

  if (!planId) {
    return [];
  }

  return employees.flatMap((employee) =>
    (employee.plan_commission_rules ?? [])
      .filter((rule) => rule.plan_id === planId)
      .map((rule) => ({
        _key: `existing-${rule.id}`,
        calculation_type: rule.calculation_type,
        employee_id: String(employee.id),
        id: rule.id,
        is_active: rule.is_active,
        value: rule.value,
      })),
  );
}

function PlanEmployeesSection({
  activeLabel,
  addLabel,
  commissionTypeLabel,
  commissionValueLabel,
  deleteLabel,
  description,
  employeeLabel,
  employees,
  fixedLabel,
  percentLabel,
  rules,
  setRules,
  title,
}: {
  activeLabel: string;
  addLabel: string;
  commissionTypeLabel: string;
  commissionValueLabel: string;
  deleteLabel: string;
  description: string;
  employeeLabel: string;
  employees: PlanEmployeeOption[];
  fixedLabel: string;
  percentLabel: string;
  rules: PlanEmployeeCommissionDraft[];
  setRules: React.Dispatch<React.SetStateAction<PlanEmployeeCommissionDraft[]>>;
  title: string;
}) {
  const employeeOptions = React.useMemo(() => {
    const baseOptions = employees.map((employee) => ({
      value: String(employee.id),
      label: employee.role ? `${employee.name} - ${employee.role}` : employee.name,
    }));

    const knownValues = new Set(baseOptions.map((option) => option.value));
    const missingOptions = rules
      .map((rule) => rule.employee_id)
      .filter((employeeId) => employeeId && !knownValues.has(employeeId))
      .map((employeeId) => ({
        value: employeeId,
        label: `Employee #${employeeId}`,
      }));

    return [...baseOptions, ...missingOptions];
  }, [employees, rules]);

  return (
    <div className="grid gap-3 rounded-lg border border-dashed p-4">
      <div className="space-y-1">
        <Label>{title}</Label>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>

      {rules.map((rule, index) => (
        <div key={rule._key} className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2 sm:col-span-2 xl:col-span-1">
            <Label>{employeeLabel}</Label>
            <FormSelect
              value={rule.employee_id}
              className="min-w-0"
              contentClassName="w-[24rem] max-w-[calc(100vw-2rem)]"
              onValueChange={(value) =>
                setRules((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, employee_id: value ?? "" } : item,
                  ),
                )
              }
              options={employeeOptions}
            />
          </div>

          <div className="space-y-2">
            <Label>{commissionTypeLabel}</Label>
            <FormSelect
              value={rule.calculation_type}
              className="min-w-0"
              contentClassName="max-w-[calc(100vw-2rem)]"
              onValueChange={(value) =>
                setRules((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, calculation_type: (value as "fixed" | "percentage") ?? "fixed" }
                      : item,
                  ),
                )
              }
              options={[
                { value: "fixed", label: fixedLabel },
                { value: "percentage", label: percentLabel },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>{commissionValueLabel}</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={rule.value}
              onChange={(event) => {
                const nextValue = event.currentTarget.value;

                setRules((current) =>
                  current.map((item, itemIndex) => (itemIndex === index ? { ...item, value: nextValue } : item)),
                );
              }}
            />
          </div>

          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-1">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border px-3 py-2">
              <Checkbox
                checked={rule.is_active}
                onCheckedChange={(checked) =>
                  setRules((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, is_active: checked === true } : item,
                    ),
                  )
                }
              />
              <span className="text-sm">{activeLabel}</span>
            </div>
            <Button
              type="button"
              variant="outline"
              className="shrink-0"
              onClick={() => setRules((current) => current.filter((_, itemIndex) => itemIndex !== index))}
            >
              {deleteLabel}
            </Button>
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={() =>
          setRules((current) => [
            ...current,
            {
              _key: `new-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString()}`,
              calculation_type: "fixed",
              employee_id: employees[0] ? String(employees[0].id) : "",
              id: 0,
              is_active: true,
              value: "0",
            },
          ])
        }
      >
        {addLabel}
      </Button>
    </div>
  );
}
