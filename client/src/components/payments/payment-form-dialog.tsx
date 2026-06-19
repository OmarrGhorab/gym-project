"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppLocale } from "@/i18n/routing";
import { recordPayment } from "@/lib/actions/payments";
import type { PaymentDue } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

type PaymentFormDialogProps = {
  due: PaymentDue | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type PaymentFormState = {
  amount: string;
  method: "cash" | "card" | "bank_transfer";
  paid_at?: string;
};

export function PaymentFormDialog(props: PaymentFormDialogProps) {
  const formKey = `${props.due?.subscription.id ?? "none"}-${props.open ? "open" : "closed"}`;

  return <PaymentFormDialogContent key={formKey} {...props} />;
}

function PaymentFormDialogContent({
  due,
  open,
  onOpenChange,
}: PaymentFormDialogProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("PaymentsPage");
  const isArabic = locale === "ar";
  const [portalContainer, setPortalContainer] = React.useState<HTMLDivElement | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [form, setForm] = React.useState<PaymentFormState>(() => ({
    amount: due?.balance ?? "",
    method: "cash",
    paid_at: new Date().toISOString().slice(0, 10),
  }));

  if (!due) return null;

  const selectedDue = due;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setFieldErrors({});

    const validationErrors = validatePaymentForm({
      form,
      balance: selectedDue.balance,
      messages: {
        amount: t("amountValidation"),
        method: t("methodValidation"),
        paidAt: t("paidAtValidation"),
      },
    });

    if (Object.keys(validationErrors).length > 0) {
      setError(t("formError"));
      setFieldErrors(validationErrors);
      toast.error(t("formError"));
      setIsPending(false);
      return;
    }

    try {
      await recordPayment(
        {
          subscription_id: selectedDue.subscription.id,
          amount: form.amount.trim(),
          method: form.method,
          paid_at: form.paid_at || null,
        },
        locale as AppLocale
      );
      toast.success(t("paymentRecordedSuccess"));
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      const parsedError = parseActionError(err);

      if (parsedError) {
        setError(parsedError.message);
        setFieldErrors(parsedError.details ?? {});
        toast.error(parsedError.message);
      } else {
        const message = err instanceof Error ? err.message : t("formError");
        setError(message);
        toast.error(message);
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={setPortalContainer}
        className={cn("max-w-xl", isArabic && "rtl")}
      >
        <DialogHeader className={cn(isArabic && "text-right")}>
          <DialogTitle>{t("collectPaymentTitle")}</DialogTitle>
          <DialogDescription>
            {t("collectPaymentDescription", {
              name: selectedDue.member.name ?? t("unknownMember"),
              id: selectedDue.subscription.id,
            })}
          </DialogDescription>
        </DialogHeader>

        <form id="payment-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm font-semibold text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-3 rounded-lg border bg-muted/15 p-3 sm:grid-cols-3">
            <SummaryItem label={t("summaryTotal")} value={formatCurrency(selectedDue.price_paid, locale)} />
            <SummaryItem label={t("summaryPaid")} value={formatCurrency(selectedDue.paid_total, locale)} />
            <SummaryItem label={t("summaryBalance")} value={formatCurrency(selectedDue.balance, locale)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="amount" className={cn(isArabic && "justify-end")}>
                {t("formAmount")} *
              </Label>
              <Input
                id="amount"
                inputMode="decimal"
                value={form.amount}
                onChange={(event) =>
                  setForm((current) => ({ ...current, amount: event.target.value }))
                }
                disabled={isPending}
                className={cn("h-9", isArabic ? "text-right" : "text-left")}
              />
              <FieldError messages={fieldErrors.amount} />
            </div>

            <div className="space-y-1.5">
              <Label className={cn(isArabic && "justify-end")}>
                {t("formMethod")} *
              </Label>
              <Select
                value={form.method}
                onValueChange={(value) =>
                  setForm((current) => ({
                    ...current,
                    method: value as PaymentFormState["method"],
                  }))
                }
                disabled={isPending}
              >
                <SelectTrigger className="h-9 w-full bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align={isArabic ? "end" : "start"} alignItemWithTrigger={false}>
                  <SelectItem value="cash">{t("methodCash")}</SelectItem>
                  <SelectItem value="card">{t("methodCard")}</SelectItem>
                  <SelectItem value="bank_transfer">{t("methodBankTransfer")}</SelectItem>
                </SelectContent>
              </Select>
              <FieldError messages={fieldErrors.method} />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="paid_at" className={cn(isArabic && "justify-end")}>
                {t("formPaidAt")}
              </Label>
              <DatePicker
                id="paid_at"
                value={form.paid_at}
                onChange={(date) =>
                  setForm((current) => ({ ...current, paid_at: date }))
                }
                placeholder={t("formPaidAtPlaceholder")}
                locale={locale}
                portalContainer={portalContainer}
                disabled={isPending}
                className={cn(isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.paid_at} />
            </div>
          </div>
        </form>

        <DialogFooter className={cn("gap-2 sm:gap-2", isArabic && "flex-row-reverse")}>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t("formCancel")}
          </Button>
          <Button type="submit" form="payment-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("formCollect")}
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

function validatePaymentForm({
  form,
  balance,
  messages,
}: {
  form: PaymentFormState;
  balance: string;
  messages: {
    amount: string;
    method: string;
    paidAt: string;
  };
}) {
  const balanceAmount = Number(balance);
  const schema = z
    .object({
      amount: z.string().trim().regex(/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/, messages.amount),
      method: z.union([
        z.literal("cash"),
        z.literal("card"),
        z.literal("bank_transfer"),
      ], messages.method),
      paid_at: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      const amount = Number(data.amount);
      if (!Number.isFinite(amount) || amount <= 0 || amount > balanceAmount) {
        ctx.addIssue({
          code: "custom",
          path: ["amount"],
          message: messages.amount,
        });
      }

      if (data.paid_at && !/^\d{4}-\d{2}-\d{2}$/.test(data.paid_at)) {
        ctx.addIssue({
          code: "custom",
          path: ["paid_at"],
          message: messages.paidAt,
        });
      }
    });

  const result = schema.safeParse(form);

  if (result.success) return {};

  return Object.fromEntries(
    result.error.issues.map((issue) => [
      issue.path.join("."),
      [issue.message],
    ])
  );
}

function parseActionError(
  err: unknown
): { message: string; details?: Record<string, string[]> } | null {
  if (!(err instanceof Error)) return null;

  try {
    const parsed = JSON.parse(err.message) as {
      message?: string;
      details?: Record<string, string[]>;
    };

    return parsed.message
      ? { message: parsed.message, details: parsed.details }
      : null;
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
