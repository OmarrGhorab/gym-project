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

import { createPlan, type PlanFormState } from "./actions";

const initialPlanFormState: PlanFormState = {
  ok: false,
  errors: {},
  values: {},
};

export function PlanCreateForm() {
  const t = useTranslations("Dashboard.plans");
  const formRef = React.useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(createPlan, initialPlanFormState);
  const [unlimitedSessions, setUnlimitedSessions] = React.useState(state.values.is_unlimited_sessions === "on");
  const [freezeRequiresApproval, setFreezeRequiresApproval] = React.useState(state.values.freeze_requires_approval === "on");

  React.useEffect(() => {
    if (state.ok) {
      formRef.current?.reset();
      setUnlimitedSessions(false);
      setFreezeRequiresApproval(false);
    }
  }, [state.ok]);

  React.useEffect(() => {
    if (!state.ok) {
      setFreezeRequiresApproval(state.values.freeze_requires_approval === "on");
    }
  }, [state.ok, state.values.freeze_requires_approval]);

  return (
    <form ref={formRef} action={action} className="grid gap-4">
      {state.message ? (
        <div
          className={
            state.ok
              ? "rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-600 text-sm"
              : "rounded-md border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
          }
        >
          {state.ok ? t("planCreated") : state.message}
        </div>
      ) : null}

      <Field error={fieldError(state, "name")} label={t("name")} name="name" defaultValue={state.values.name} />

      <div className="space-y-2">
        <Label>{t("type")}</Label>
        <FormSelect
          name="type"
          defaultValue={state.values.type || "membership"}
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
          defaultValue={state.values.category || "gym_access"}
          options={[
            { value: "gym_access", label: t("categories.gym_access") },
            { value: "personal_training", label: t("categories.personal_training") },
            { value: "classes", label: t("categories.classes") },
            { value: "nutrition", label: t("categories.nutrition") },
            { value: "recovery", label: t("categories.recovery") },
          ]}
        />
      </div>

      <Field error={fieldError(state, "price")} label={t("price")} name="price" type="number" step="0.01" defaultValue={state.values.price} />
      <Field error={fieldError(state, "duration_days")} label={t("durationDays")} name="duration_days" type="number" defaultValue={state.values.duration_days || "30"} />

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
        <Field error={fieldError(state, "sessions_count")} label={t("sessionsCount")} name="sessions_count" type="number" defaultValue={state.values.sessions_count} />
      ) : null}

      <Field error={fieldError(state, "max_freeze_days")} label={t("maxFreezeDays")} name="max_freeze_days" type="number" defaultValue={state.values.max_freeze_days || "0"} />
      <Field error={fieldError(state, "min_freeze_days")} label={t("minFreezeDays")} name="min_freeze_days" type="number" defaultValue={state.values.min_freeze_days || "0"} />

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

      <DateField label={t("validFrom")} name="valid_from" placeholder={t("selectDate")} defaultValue={state.values.valid_from} />
      <DateField error={fieldError(state, "valid_to")} label={t("validTo")} name="valid_to" placeholder={t("selectDate")} defaultValue={state.values.valid_to} />
      <TimeField label={t("accessStartsAt")} name="access_starts_at" defaultValue={state.values.access_starts_at} />
      <TimeField error={fieldError(state, "access_ends_at")} label={t("accessEndsAt")} name="access_ends_at" defaultValue={state.values.access_ends_at} />

      <div className="space-y-2">
        <Label htmlFor="description">{t("descriptionField")}</Label>
        <Textarea id="description" name="description" defaultValue={state.values.description} />
      </div>

      <Button type="submit" disabled={pending}>
        <PackageCheck />
        {pending ? t("saving") : t("createPlan")}
      </Button>
    </form>
  );
}

function fieldError(state: PlanFormState, name: string) {
  return state.errors[name]?.[0];
}

function Field({
  defaultValue = "",
  error,
  label,
  name,
  step,
  type = "text",
}: {
  defaultValue?: string;
  error?: string;
  label: string;
  name: string;
  step?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} step={step} defaultValue={defaultValue} aria-invalid={Boolean(error)} />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

function DateField({
  defaultValue,
  error,
  label,
  name,
  placeholder,
}: {
  defaultValue?: string;
  error?: string;
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <FormDatePicker name={name} placeholder={placeholder} defaultValue={defaultValue} />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

function TimeField({ defaultValue, error, label, name }: { defaultValue?: string; error?: string; label: string; name: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <FormTimePicker name={name} defaultValue={defaultValue} />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}


