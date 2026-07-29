"use client";

import * as React from "react";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import {
  generatePayroll,
  markPayrollPaid,
  type PayrollActionResult,
  type PayrollActionState,
  updatePayroll,
} from "./actions";

const initialPayrollState: PayrollActionState = {
  ok: false,
  message: "",
  errors: {},
  values: {},
};

export function PayrollAdjustmentForm({
  attendanceDeductions,
  bonuses,
  deductions,
  id,
  manualBonusReason,
  manualDeductionReason,
}: {
  attendanceDeductions: string;
  bonuses: string;
  deductions: string;
  id: number;
  manualBonusReason?: string;
  manualDeductionReason?: string;
}) {
  const t = useTranslations("Dashboard.payroll");
  const [state, formAction, pending] = React.useActionState(updatePayroll, initialPayrollState);
  const [bonusValue, setBonusValue] = React.useState(bonuses);
  const [deductionValue, setDeductionValue] = React.useState(deductions);
  const [attendanceDeductionValue, setAttendanceDeductionValue] = React.useState(attendanceDeductions);
  const [manualBonusReasonValue, setManualBonusReasonValue] = React.useState(manualBonusReason ?? "");
  const [manualDeductionReasonValue, setManualDeductionReasonValue] = React.useState(manualDeductionReason ?? "");
  const attendanceDeductionInputId = `payroll-${id}-attendance-deduction`;
  const bonusInputId = `payroll-${id}-bonus`;
  const deductionInputId = `payroll-${id}-deduction`;

  React.useEffect(() => {
    setBonusValue(bonuses);
  }, [bonuses]);

  React.useEffect(() => {
    setDeductionValue(deductions);
  }, [deductions]);

  React.useEffect(() => {
    setAttendanceDeductionValue(attendanceDeductions);
  }, [attendanceDeductions]);

  React.useEffect(() => {
    setManualBonusReasonValue(manualBonusReason ?? "");
  }, [manualBonusReason]);

  React.useEffect(() => {
    setManualDeductionReasonValue(manualDeductionReason ?? "");
  }, [manualDeductionReason]);

  React.useEffect(() => {
    if (!state.message) {
      return;
    }

    if (state.ok) {
      toast.success(state.message);
      return;
    }

    toast.error(t("actionFailed"), { description: state.message });
  }, [state, t]);

  return (
    <form action={formAction} className="grid w-full grid-cols-2 gap-2">
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
          aria-invalid={Boolean(state.errors.bonuses?.[0])}
          disabled={pending}
          onChange={(event) => setBonusValue(event.target.value)}
        />
        <FieldError errors={state.errors.bonuses} />
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
          aria-invalid={Boolean(state.errors.deductions?.[0])}
          disabled={pending}
          onChange={(event) => setDeductionValue(event.target.value)}
        />
        <FieldError errors={state.errors.deductions} />
      </label>
      <label className="grid gap-1" htmlFor={`payroll-${id}-bonus-reason`}>
        <span className="text-muted-foreground text-xs">{t("manualBonusReason")}</span>
        <Input
          id={`payroll-${id}-bonus-reason`}
          name="manual_bonus_reason"
          maxLength={500}
          placeholder={t("manualReasonPlaceholder")}
          value={manualBonusReasonValue}
          aria-invalid={Boolean(state.errors.manual_bonus_reason?.[0])}
          disabled={pending}
          onChange={(event) => setManualBonusReasonValue(event.target.value)}
        />
        <FieldError errors={state.errors.manual_bonus_reason} />
      </label>
      <label className="grid gap-1" htmlFor={`payroll-${id}-deduction-reason`}>
        <span className="text-muted-foreground text-xs">{t("manualDeductionReason")}</span>
        <Input
          id={`payroll-${id}-deduction-reason`}
          name="manual_deduction_reason"
          maxLength={500}
          placeholder={t("manualReasonPlaceholder")}
          value={manualDeductionReasonValue}
          aria-invalid={Boolean(state.errors.manual_deduction_reason?.[0])}
          disabled={pending}
          onChange={(event) => setManualDeductionReasonValue(event.target.value)}
        />
        <FieldError errors={state.errors.manual_deduction_reason} />
      </label>
      <label className="grid gap-1" htmlFor={attendanceDeductionInputId}>
        <span className="text-muted-foreground text-xs">{t("attendanceDeductionApplied")}</span>
        <Input
          id={attendanceDeductionInputId}
          name="attendance_deductions"
          type="number"
          min="0"
          step="0.01"
          value={attendanceDeductionValue}
          aria-label={t("attendanceDeductionApplied")}
          aria-invalid={Boolean(state.errors.attendance_deductions?.[0])}
          disabled={pending}
          onChange={(event) => setAttendanceDeductionValue(event.target.value)}
        />
        <FieldError errors={state.errors.attendance_deductions} />
      </label>
      <div className="flex items-end">
        <Button className="w-full" type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? t("saving") : t("save")}
        </Button>
      </div>
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
            const result = await markPayrollPaid(formData);

            if (result.ok) {
              toast.success(result.message);
              return;
            }

            toast.error(t("actionFailed"), { description: result.message });
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

export function PayrollGenerateForm({ children }: { children: React.ReactNode }) {
  const t = useTranslations("Dashboard.payroll");
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<PayrollActionResult["errors"]>({});

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await generatePayroll(formData);
      setErrors(result.errors ?? {});

      if (result.ok) {
        toast.success(result.message);
        return;
      }

      toast.error(t("actionFailed"), { description: result.message });
    });
  }

  return (
    <form action={submit} className="flex flex-wrap items-end gap-2" aria-busy={pending}>
      {children}
      <FieldError errors={errors?.month} />
    </form>
  );
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined;
}
