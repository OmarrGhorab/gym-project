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
import type { AppLocale } from "@/i18n/routing";
import { createSubscription } from "@/lib/actions/subscriptions";
import type { Member, Plan } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

type SubscriptionFormDialogProps = {
  members: Member[];
  plans: Plan[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type SubscriptionFormState = {
  member_id: string;
  member_query: string;
  plan_id: string;
  start_date: string;
  end_date: string;
  discount: string;
  payment_amount: string;
  payment_method: "cash" | "card" | "bank_transfer";
};

export function SubscriptionFormDialog({
  members,
  plans,
  open,
  onOpenChange,
}: SubscriptionFormDialogProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("SubscriptionsPage");
  const isArabic = locale === "ar";
  const [portalContainer, setPortalContainer] = React.useState<HTMLDivElement | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [form, setForm] = React.useState<SubscriptionFormState>(() => initialState());

  const selectedPlan = React.useMemo(
    () => plans.find((plan) => String(plan.id) === form.plan_id),
    [form.plan_id, plans]
  );
  const selectedMember = React.useMemo(
    () => members.find((member) => String(member.id) === form.member_id),
    [form.member_id, members]
  );
  const memberOptions = React.useMemo(() => {
    const query = form.member_query.trim().toLowerCase();
    return members
      .filter((member) => {
        if (!query) return true;
        return (
          String(member.id).includes(query) ||
          member.name.toLowerCase().includes(query) ||
          (member.phone ?? "").toLowerCase().includes(query)
        );
      })
      .slice(0, 25);
  }, [form.member_query, members]);

  function updateForm<K extends keyof SubscriptionFormState>(
    key: K,
    value: SubscriptionFormState[K]
  ) {
    setForm((current) => {
      const next = { ...current, [key]: value };
      const nextPlan = plans.find((plan) => String(plan.id) === next.plan_id);

      if (key === "plan_id" || key === "start_date") {
        next.end_date =
          next.plan_id && next.start_date
            ? getComputedExpiryDate(next.start_date, nextPlan?.duration_days) ?? next.end_date
            : next.end_date;
      }

      if (key === "plan_id" || key === "start_date" || key === "end_date" || key === "discount") {
        const total = getSubscriptionTotal(
          nextPlan?.price,
          next.discount,
          next.start_date,
          next.end_date,
          nextPlan?.duration_days
        );
        if (total !== undefined && total >= 0) {
          next.payment_amount = total.toFixed(2);
        }
      }

      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const validation = validate(form, {
      member: t("memberValidation"),
      plan: t("planValidation"),
      startDate: t("startDateValidation"),
      endDate: t("endDateValidation"),
      discount: t("discountValidation"),
      paymentAmount: t("paymentAmountValidation"),
    });

    if (Object.keys(validation).length > 0) {
      setFieldErrors(validation);
      setError(t("formError"));
      toast.error(t("formError"));
      return;
    }

    setIsPending(true);
    try {
      await createSubscription(
        {
          member_id: Number(form.member_id),
          plan_id: Number(form.plan_id),
          start_date: form.start_date,
          end_date: form.end_date || null,
          discount: form.discount.trim() || "0.00",
          payment: {
            amount: form.payment_amount.trim(),
            method: form.payment_method,
          },
        },
        locale as AppLocale
      );
      toast.success(t("subscriptionCreatedSuccess"));
      setForm(initialState());
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      const parsed = parseActionError(err);
      setError(parsed?.message ?? (err instanceof Error ? err.message : t("formError")));
      setFieldErrors(parsed?.details ?? {});
      toast.error(parsed?.message ?? (err instanceof Error ? err.message : t("formError")));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={setPortalContainer} className={cn("max-w-2xl", isArabic && "rtl")}>
        <DialogHeader className={cn(isArabic && "text-right")}>
          <DialogTitle>{t("newSubscriptionTitle")}</DialogTitle>
          <DialogDescription>{t("newSubscriptionDescription")}</DialogDescription>
        </DialogHeader>

        <form id="subscription-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm font-semibold text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="member_query" className={cn(isArabic && "justify-end")}>
                {t("formMember")} *
              </Label>
              <Input
                id="member_query"
                value={form.member_query}
                onChange={(event) => updateForm("member_query", event.target.value)}
                placeholder={t("memberSearchPlaceholder")}
                disabled={isPending}
                className={cn("h-9", isArabic && "text-right")}
              />
              <div className="grid max-h-36 gap-1 overflow-y-auto rounded-md border bg-card p-1">
                {memberOptions.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => {
                      updateForm("member_id", String(member.id));
                      updateForm("member_query", `${member.name} #${member.id}`);
                    }}
                    className={cn(
                      "rounded px-2 py-1.5 text-left text-xs font-semibold hover:bg-muted",
                      form.member_id === String(member.id) && "bg-primary/10 text-primary",
                      isArabic && "text-right"
                    )}
                    disabled={isPending}
                  >
                    {member.name} #{member.id} {member.phone ? `- ${member.phone}` : ""}
                  </button>
                ))}
              </div>
              {selectedMember && (
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("selectedMember", { name: selectedMember.name, id: selectedMember.id })}
                </p>
              )}
              <FieldError messages={fieldErrors.member_id} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan_id" className={cn(isArabic && "justify-end")}>
                {t("formPlan")} *
              </Label>
              <select
                id="plan_id"
                value={form.plan_id}
                onChange={(event) => updateForm("plan_id", event.target.value)}
                disabled={isPending}
                className={cn("h-9 w-full rounded-md border bg-card px-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50", isArabic && "text-right")}
              >
                <option value="">{t("formPlanPlaceholder")}</option>
                {plans
                  .filter((plan) => plan.is_sellable !== false)
                  .map((plan) => (
                    <option key={plan.id} value={String(plan.id)}>
                      {plan.name}
                    </option>
                  ))}
              </select>
              <FieldError messages={fieldErrors.plan_id} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="discount" className={cn(isArabic && "justify-end")}>
                {t("formDiscount")}
              </Label>
              <Input
                id="discount"
                inputMode="decimal"
                value={form.discount}
                onChange={(event) => updateForm("discount", event.target.value)}
                disabled={isPending}
                className={cn("h-9", isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.discount} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="start_date" className={cn(isArabic && "justify-end")}>
                {t("formStartDate")} *
              </Label>
              <DatePicker
                id="start_date"
                value={form.start_date}
                onChange={(date) => updateForm("start_date", date ?? "")}
                placeholder={t("startDatePlaceholder")}
                locale={locale}
                portalContainer={portalContainer}
                disabled={isPending}
                className={cn(isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.start_date} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="end_date" className={cn(isArabic && "justify-end")}>
                {t("formEndDate")}
              </Label>
              <DatePicker
                id="end_date"
                value={form.end_date}
                onChange={(date) => updateForm("end_date", date ?? "")}
                placeholder={t("endDatePlaceholder")}
                locale={locale}
                portalContainer={portalContainer}
                disabled={isPending}
                className={cn(isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.end_date} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payment_amount" className={cn(isArabic && "justify-end")}>
                {t("formPaymentAmount")} *
              </Label>
              <Input
                id="payment_amount"
                inputMode="decimal"
                value={form.payment_amount}
                onChange={(event) => updateForm("payment_amount", event.target.value)}
                disabled={isPending}
                className={cn("h-9", isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors["payment.amount"]} />
              {selectedPlan && (
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("paymentHint", { amount: formatMoney(getSubscriptionTotal(selectedPlan.price, form.discount, form.start_date, form.end_date, selectedPlan.duration_days) ?? Number(selectedPlan.price)) })}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="payment_method" className={cn(isArabic && "justify-end")}>
                {t("formPaymentMethod")} *
              </Label>
              <select
                id="payment_method"
                value={form.payment_method}
                onChange={(event) => updateForm("payment_method", event.target.value as SubscriptionFormState["payment_method"])}
                disabled={isPending}
                className={cn("h-9 w-full rounded-md border bg-card px-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50", isArabic && "text-right")}
              >
                <option value="cash">{t("paymentCash")}</option>
                <option value="card">{t("paymentCard")}</option>
                <option value="bank_transfer">{t("paymentBank")}</option>
              </select>
              <FieldError messages={fieldErrors["payment.method"]} />
            </div>
          </div>
        </form>

        <DialogFooter className={cn("gap-2 sm:gap-2", isArabic && "flex-row-reverse")}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("formCancel")}
          </Button>
          <Button type="submit" form="subscription-form" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            {t("formCreate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function initialState(): SubscriptionFormState {
  const today = new Date().toISOString().slice(0, 10);

  return {
    member_id: "",
    member_query: "",
    plan_id: "",
    start_date: today,
    end_date: "",
    discount: "0.00",
    payment_amount: "",
    payment_method: "cash",
  };
}

function validate(
  form: SubscriptionFormState,
  messages: {
    member: string;
    plan: string;
    startDate: string;
    endDate: string;
    discount: string;
    paymentAmount: string;
  }
) {
  const schema = z.object({
    member_id: z.string().regex(/^[1-9]\d*$/, messages.member),
    plan_id: z.string().regex(/^[1-9]\d*$/, messages.plan),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, messages.startDate),
    end_date: z.string().optional(),
    discount: z.string().regex(/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/, messages.discount),
    payment_amount: z.string().regex(/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/, messages.paymentAmount),
  }).refine(
    (value) => !value.end_date || /^\d{4}-\d{2}-\d{2}$/.test(value.end_date),
    { path: ["end_date"], message: messages.endDate }
  ).refine(
    (value) => !value.end_date || value.end_date >= value.start_date,
    { path: ["end_date"], message: messages.endDate }
  ).refine(
    (value) => Number(value.payment_amount) > 0,
    { path: ["payment.amount"], message: messages.paymentAmount }
  );

  const result = schema.safeParse(form);
  if (result.success) return {};

  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), [issue.message]])
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;

  return <p className="text-xs font-medium text-destructive">{messages[0]}</p>;
}

function getComputedExpiryDate(startDate?: string, durationDays?: number) {
  if (!startDate || !durationDays) return undefined;

  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return undefined;

  date.setDate(date.getDate() + durationDays);
  return date.toISOString().slice(0, 10);
}

function getSubscriptionTotal(
  planPrice?: string,
  discount?: string,
  startDate?: string,
  endDate?: string,
  durationDays?: number
) {
  const price = Number(planPrice);
  if (!Number.isFinite(price)) return undefined;

  return price * getSubscriptionCycles(startDate, endDate, durationDays) - (Number(discount) || 0);
}

function getSubscriptionCycles(startDate?: string, endDate?: string, durationDays?: number) {
  if (!startDate || !endDate || !durationDays || durationDays <= 0) return 1;

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 1;

  const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(1, Math.ceil(days / durationDays));
}

function formatMoney(value: number) {
  return Number.isFinite(value) ? value.toFixed(2) : "0.00";
}

function parseActionError(err: unknown): { message: string; details?: Record<string, string[]> } | null {
  if (!(err instanceof Error)) return null;
  try {
    const parsed = JSON.parse(err.message) as {
      message?: string;
      details?: Record<string, string[]>;
    };
    return parsed.message ? { message: parsed.message, details: parsed.details } : null;
  } catch {
    return null;
  }
}
