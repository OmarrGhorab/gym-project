"use client";

import { useTranslations } from "next-intl";

import { FormSelect } from "@/components/ui/form-controls";
import { Label } from "@/components/ui/label";

import { PLAN_TYPES, type PlanType, planTypeMessageKey } from "./plan-types";

type PlanTypeFieldProps = {
  id: string;
  onChange: (type: PlanType) => void;
  value: PlanType;
};

/**
 * Picks the single plan type a category belongs to. Shared by the inline
 * "Add category" dialog and the category management screen so the two can never
 * drift apart.
 *
 * Single choice, not multi: the plan type list already spells out the combined
 * cases ("Offer package", "Membership + extra service"), so letting a category
 * span several types would just re-encode a combination that is already a type.
 */
export function PlanTypeField({ id, onChange, value }: PlanTypeFieldProps) {
  const t = useTranslations("Dashboard.plans");

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{t("categoryTypeLabel")}</Label>
      <FormSelect
        id={id}
        name={id}
        onValueChange={(next) => onChange((next as PlanType) || "membership")}
        options={PLAN_TYPES.map((type) => ({ label: t(planTypeMessageKey(type)), value: type }))}
        value={value}
      />
      <p className="text-muted-foreground text-xs">{t("categoryTypeHelp")}</p>
    </div>
  );
}
