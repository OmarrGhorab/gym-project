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
import type { PlanRow } from "./data";

const initialPlanFormState: PlanFormState = {
  ok: false,
  errors: {},
  values: {},
};

type PlanFormProps = {
  mode?: "create" | "edit";
  plan?: PlanRow;
};

export function PlanCreateForm({ mode = "create", plan }: PlanFormProps) {
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
  const initialDurationBasis = state.values.duration_basis || (plan?.duration_months ? "months" : "days");
  const initialDurationMonths = state.values.duration_months || valueOrPlan(state, plan, "duration_months") || "1";
  const initialValidFrom = state.values.valid_from || valueOrPlan(state, plan, "valid_from");
  const initialValidTo = state.values.valid_to || valueOrPlan(state, plan, "valid_to");
  const [planType, setPlanType] = React.useState(initialPlanType);
  const [unlimitedSessions, setUnlimitedSessions] = React.useState(initialUnlimitedSessions);
  const [freezeRequiresApproval, setFreezeRequiresApproval] = React.useState(initialFreezeRequiresApproval);
  const [durationBasis, setDurationBasis] = React.useState(initialDurationBasis);
  const [durationMonths, setDurationMonths] = React.useState(initialDurationMonths);
  const [validFrom, setValidFrom] = React.useState(initialValidFrom);
  const [validTo, setValidTo] = React.useState(initialValidTo);
  const offerDurationDays = calculateInclusiveDays(validFrom, validTo);

  React.useEffect(() => {
    if (state.ok) {
      if (mode === "create") {
        formRef.current?.reset();
        setPlanType("membership");
        setUnlimitedSessions(false);
        setFreezeRequiresApproval(false);
        setDurationBasis("days");
        setDurationMonths("1");
        setValidFrom("");
        setValidTo("");
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
      setDurationBasis(state.values.duration_basis || (plan?.duration_months ? "months" : "days"));
      setDurationMonths(state.values.duration_months || valueOrPlan(state, plan, "duration_months") || "1");
      setValidFrom(state.values.valid_from || valueOrPlan(state, plan, "valid_from"));
      setValidTo(state.values.valid_to || valueOrPlan(state, plan, "valid_to"));
    }
  }, [
    plan,
    plan?.duration_months,
    plan?.freeze_requires_approval,
    state,
    state.ok,
    state.values.duration_basis,
    state.values.duration_months,
    state.values.freeze_requires_approval,
    state.values.type,
    state.values.valid_from,
    state.values.valid_to,
  ]);

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      {mode === "edit" && plan ? <input type="hidden" name="id" value={plan.id} /> : null}
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
        <Label>{t("type")}</Label>
        <FormSelect
          name="type"
          defaultValue={planType}
          onValueChange={(value) => setPlanType(value || "membership")}
          options={[
            { value: "membership", label: t("planTypes.membership") },
            { value: "offer", label: t("planTypes.offer") },
          ]}
        />
      </div>

      <div className="space-y-2">
        <Label>{t("category")}</Label>
        <FormSelect
          name="category"
          defaultValue={valueOrPlan(state, plan, "category") || "gym_access"}
          options={[
            { value: "gym_access", label: t("categories.gym_access") },
            { value: "personal_training", label: t("categories.personal_training") },
            { value: "classes", label: t("categories.classes") },
            { value: "nutrition", label: t("categories.nutrition") },
            { value: "recovery", label: t("categories.recovery") },
          ]}
        />
      </div>

      <Field
        error={fieldError(state, "price")}
        label={t("price")}
        name="price"
        type="number"
        step="0.01"
        defaultValue={valueOrPlan(state, plan, "price")}
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
          <Label>{t("durationType")}</Label>
          <FormSelect
            name="duration_basis"
            defaultValue={durationBasis}
            onValueChange={(value) => setDurationBasis(value)}
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
      <Label>{label}</Label>
      <FormDatePicker name={name} placeholder={placeholder} defaultValue={defaultValue} onValueChange={onValueChange} />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
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
      <Label>{label}</Label>
      <FormTimePicker name={name} defaultValue={defaultValue} />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
