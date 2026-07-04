"use client";

import * as React from "react";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { markPayrollPaid, updatePayroll } from "./actions";

export function PayrollAdjustmentForm({
  bonuses,
  deductions,
  id,
}: {
  bonuses: string;
  deductions: string;
  id: number;
}) {
  const t = useTranslations("Dashboard.payroll");
  const [pending, startTransition] = React.useTransition();
  const [bonusValue, setBonusValue] = React.useState(bonuses);
  const [deductionValue, setDeductionValue] = React.useState(deductions);
  const bonusInputId = `payroll-${id}-bonus`;
  const deductionInputId = `payroll-${id}-deduction`;

  React.useEffect(() => {
    setBonusValue(bonuses);
  }, [bonuses]);

  React.useEffect(() => {
    setDeductionValue(deductions);
  }, [deductions]);

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          try {
            await updatePayroll(formData);
            toast.success(t("payrollSaved"));
          } catch (error) {
            toast.error(t("actionFailed"), { description: getErrorMessage(error) });
          }
        });
      }}
      className="grid w-full grid-cols-[minmax(6.5rem,1fr)_minmax(6.5rem,1fr)_auto] items-end gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <label className="grid gap-1" htmlFor={bonusInputId}>
        <span className="text-muted-foreground text-xs">{t("bonusAdds")}</span>
        <Input
          id={bonusInputId}
          name="bonuses"
          type="number"
          min="0"
          step="0.01"
          value={bonusValue}
          aria-label={t("bonusAdds")}
          disabled={pending}
          onChange={(event) => setBonusValue(event.target.value)}
        />
      </label>
      <label className="grid gap-1" htmlFor={deductionInputId}>
        <span className="text-muted-foreground text-xs">{t("deductionSubtracts")}</span>
        <Input
          id={deductionInputId}
          name="deductions"
          type="number"
          min="0"
          step="0.01"
          value={deductionValue}
          aria-label={t("deductionSubtracts")}
          disabled={pending}
          onChange={(event) => setDeductionValue(event.target.value)}
        />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}

export function PayrollPayForm({ id }: { id: number }) {
  const t = useTranslations("Dashboard.payroll");
  const [pending, startTransition] = React.useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          try {
            await markPayrollPaid(formData);
            toast.success(t("payrollPaid"));
          } catch (error) {
            toast.error(t("actionFailed"), { description: getErrorMessage(error) });
          }
        });
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? t("paying") : t("pay")}
      </Button>
    </form>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined;
}
