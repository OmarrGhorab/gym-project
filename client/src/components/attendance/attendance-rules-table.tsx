"use client";

import * as React from "react";
import { Loader2, Save } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppLocale } from "@/i18n/routing";
import { updateAttendanceViolationRule } from "@/lib/actions/attendance";
import type { AttendanceViolationRule } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

type RuleState = {
  threshold_minutes: string;
  deduction_days: string;
  requires_admin_approval: boolean;
  auto_apply_if_unreviewed: boolean;
  is_active: boolean;
};

export function AttendanceRulesTable({
  rules,
}: {
  rules: AttendanceViolationRule[];
}) {
  const locale = useLocale();
  const t = useTranslations("AttendancePage");
  const isArabic = locale === "ar";

  if (rules.length === 0) {
    return (
      <div className="p-6 text-center text-sm font-semibold text-muted-foreground">
        {t("rulesEmpty")}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full text-sm", isArabic ? "text-right" : "text-left")}>
        <thead className="border-b bg-muted/20 text-xs font-bold text-muted-foreground">
          <tr>
            <th className="px-3 py-2">{t("ruleName")}</th>
            <th className="px-3 py-2">{t("ruleThreshold")}</th>
            <th className="px-3 py-2">{t("ruleDeductionDays")}</th>
            <th className="px-3 py-2">{t("ruleAdminApproval")}</th>
            <th className="px-3 py-2">{t("ruleAutoApply")}</th>
            <th className="px-3 py-2">{t("ruleActive")}</th>
            <th className="px-3 py-2">{t("tableActions")}</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((rule) => (
            <RuleRow key={rule.id} rule={rule} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RuleRow({ rule }: { rule: AttendanceViolationRule }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("AttendancePage");
  const [form, setForm] = React.useState<RuleState>({
    threshold_minutes: rule.threshold_minutes == null ? "" : String(rule.threshold_minutes),
    deduction_days: rule.deduction_days,
    requires_admin_approval: rule.requires_admin_approval,
    auto_apply_if_unreviewed: rule.auto_apply_if_unreviewed,
    is_active: rule.is_active,
  });
  const [isPending, setIsPending] = React.useState(false);

  function updateForm<K extends keyof RuleState>(key: K, value: RuleState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const threshold = form.threshold_minutes.trim();
    const deduction = Number(form.deduction_days);
    if (!Number.isFinite(deduction) || deduction < 0) {
      toast.error(t("ruleDeductionValidation"));
      return;
    }
    if (threshold && (!/^\d+$/.test(threshold) || Number(threshold) > 1440)) {
      toast.error(t("ruleThresholdValidation"));
      return;
    }

    setIsPending(true);
    try {
      await updateAttendanceViolationRule(
        rule.id,
        {
          threshold_minutes: threshold ? Number(threshold) : null,
          deduction_days: form.deduction_days,
          requires_admin_approval: form.requires_admin_approval,
          auto_apply_if_unreviewed: form.auto_apply_if_unreviewed,
          is_active: form.is_active,
        },
        locale as AppLocale
      );
      toast.success(t("ruleSaved"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("formError"));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <tr className="border-b transition-colors hover:bg-muted/30">
      <td className="min-w-56 px-3 py-2">
        <p className="text-sm font-black text-foreground">{rule.name}</p>
        <p className="text-xs font-semibold text-muted-foreground">{rule.description ?? rule.code}</p>
      </td>
      <td className="px-3 py-2">
        <Input
          value={form.threshold_minutes}
          onChange={(event) => updateForm("threshold_minutes", event.target.value)}
          inputMode="numeric"
          className="h-8 w-24"
          disabled={isPending}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          value={form.deduction_days}
          onChange={(event) => updateForm("deduction_days", event.target.value)}
          inputMode="decimal"
          className="h-8 w-24"
          disabled={isPending}
        />
      </td>
      <td className="px-3 py-2">
        <BooleanInput
          checked={form.requires_admin_approval}
          onChange={(checked) => updateForm("requires_admin_approval", checked)}
          disabled={isPending}
        />
      </td>
      <td className="px-3 py-2">
        <BooleanInput
          checked={form.auto_apply_if_unreviewed}
          onChange={(checked) => updateForm("auto_apply_if_unreviewed", checked)}
          disabled={isPending}
        />
      </td>
      <td className="px-3 py-2">
        <BooleanInput
          checked={form.is_active}
          onChange={(checked) => updateForm("is_active", checked)}
          disabled={isPending}
        />
      </td>
      <td className="px-3 py-2">
        <Button type="button" size="icon-sm" variant="ghost" onClick={save} disabled={isPending} title={t("ruleSave")}>
          {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
        </Button>
      </td>
    </tr>
  );
}

function BooleanInput({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      disabled={disabled}
      className="size-4 rounded border-border accent-primary"
    />
  );
}
