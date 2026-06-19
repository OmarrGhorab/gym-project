"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
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
import type { AppLocale } from "@/i18n/routing";
import { updatePayroll } from "@/lib/actions/payroll";
import type { Payroll } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

type PayrollAdjustDialogProps = {
  payroll: Payroll | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PayrollAdjustDialog(props: PayrollAdjustDialogProps) {
  const formKey = `${props.payroll?.id ?? "none"}-${props.open ? "open" : "closed"}`;

  return <PayrollAdjustDialogContent key={formKey} {...props} />;
}

function PayrollAdjustDialogContent({
  payroll,
  open,
  onOpenChange,
}: PayrollAdjustDialogProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("PayrollPage");
  const isArabic = locale === "ar";
  const [bonuses, setBonuses] = React.useState(payroll?.bonuses ?? "0.00");
  const [deductions, setDeductions] = React.useState(payroll?.deductions ?? "0.00");
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  if (!payroll) return null;

  const selectedPayroll = payroll;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const validationErrors = validateAdjustment({
      bonuses,
      deductions,
      messages: {
        bonuses: t("bonusesValidation"),
        deductions: t("deductionsValidation"),
      },
    });

    if (Object.keys(validationErrors).length > 0) {
      setError(t("formError"));
      setFieldErrors(validationErrors);
      return;
    }

    setIsPending(true);
    try {
      await updatePayroll(
        selectedPayroll.id,
        {
          bonuses: bonuses.trim() || "0",
          deductions: deductions.trim() || "0",
        },
        locale as AppLocale
      );
      toast.success(t("payrollAdjustedSuccess"));
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      const parsed = parseActionError(err);
      const message = parsed?.message ?? (err instanceof Error ? err.message : t("formError"));
      setError(message);
      setFieldErrors(parsed?.details ?? {});
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-md", isArabic && "rtl")}>
        <DialogHeader className={cn(isArabic && "text-right")}>
          <DialogTitle>{t("adjustTitle")}</DialogTitle>
          <DialogDescription>
            {t("adjustDescription", {
              name: selectedPayroll.employee.name ?? t("unknownEmployee"),
              month: selectedPayroll.month,
            })}
          </DialogDescription>
        </DialogHeader>

        <form id="adjust-payroll-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm font-semibold text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-3 rounded-lg border bg-muted/15 p-3 sm:grid-cols-2">
            <SummaryItem label={t("tableBase")} value={formatCurrency(selectedPayroll.base_salary, locale)} />
            <SummaryItem label={t("tableCommission")} value={formatCurrency(selectedPayroll.commissions_total, locale)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bonuses" className={cn(isArabic && "justify-end")}>
                {t("formBonuses")}
              </Label>
              <Input
                id="bonuses"
                inputMode="decimal"
                value={bonuses}
                onChange={(event) => setBonuses(event.target.value)}
                disabled={isPending}
                className={cn("h-9", isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.bonuses} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="deductions" className={cn(isArabic && "justify-end")}>
                {t("formDeductions")}
              </Label>
              <Input
                id="deductions"
                inputMode="decimal"
                value={deductions}
                onChange={(event) => setDeductions(event.target.value)}
                disabled={isPending}
                className={cn("h-9", isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.deductions} />
            </div>
          </div>
        </form>

        <DialogFooter className={cn("gap-2 sm:gap-2", isArabic && "flex-row-reverse")}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("formCancel")}
          </Button>
          <Button type="submit" form="adjust-payroll-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("formSave")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="text-sm font-black text-foreground tabular-nums">{value}</p>
    </div>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs font-medium text-destructive">{messages[0]}</p>;
}

function validateAdjustment({
  bonuses,
  deductions,
  messages,
}: {
  bonuses: string;
  deductions: string;
  messages: { bonuses: string; deductions: string };
}) {
  const schema = z.object({
    bonuses: z.string().trim().regex(/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/, messages.bonuses),
    deductions: z.string().trim().regex(/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/, messages.deductions),
  });
  const result = schema.safeParse({ bonuses, deductions });
  if (result.success) return {};
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), [issue.message]])
  );
}

function parseActionError(err: unknown): { message: string; details?: Record<string, string[]> } | null {
  if (!(err instanceof Error)) return null;
  try {
    const parsed = JSON.parse(err.message) as { message?: string; details?: Record<string, string[]> };
    return parsed.message ? { message: parsed.message, details: parsed.details } : null;
  } catch {
    return null;
  }
}

function formatCurrency(value: string | number, locale: string) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return "-";
  return amount.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  });
}
