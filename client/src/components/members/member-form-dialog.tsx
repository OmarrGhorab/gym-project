"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import {
  createMember,
  getMemberForEdit,
  updateMember,
} from "@/lib/actions/members";
import type { Member, Plan } from "@/lib/api/dashboard";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type MemberFormDialogProps = {
  mode: "add" | "edit";
  member?: Member | null;
  plans?: Plan[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function MemberFormDialog({
  mode,
  member,
  plans,
  open,
  onOpenChange,
  onSuccess,
}: MemberFormDialogProps) {
  const formKey = `${mode}-${member?.id ?? "new"}-${open ? "open" : "closed"}`;

  return (
    <MemberFormDialogContent
      key={formKey}
      member={member}
      mode={mode}
      plans={plans}
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
    />
  );
}

type MemberFormState = {
  name: string;
  phone: string;
  email: string;
  gender: "" | "male" | "female";
  birth_date?: string;
  national_id: string;
  join_date?: string;
  plan_id: string;
  discount: string;
  payment_amount: string;
  payment_method: "cash" | "card" | "bank_transfer";
  notes: string;
  status: "active" | "inactive";
};

function MemberFormDialogContent({
  mode,
  member,
  plans = [],
  open,
  onOpenChange,
  onSuccess,
}: MemberFormDialogProps) {
  const locale = useLocale();
  const t = useTranslations("MembersPage");
  const isArabic = locale === "ar";
  const isEditing = mode === "edit";
  const [portalContainer, setPortalContainer] = React.useState<HTMLDivElement | null>(null);

  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [form, setForm] = React.useState<MemberFormState>(() =>
    toMemberFormState(member)
  );

  const selectedPlan = React.useMemo(
    () => plans.find((plan) => String(plan.id) === form.plan_id),
    [plans, form.plan_id]
  );
  const joinedDate = form.join_date;
  const computedExpiryDate = getComputedExpiryDate(
    joinedDate,
    selectedPlan?.duration_days
  );
  const payableAmount = getPayableAmount(selectedPlan?.price, form.discount);

  React.useEffect(() => {
    if (!open || !isEditing || !member?.id) {
      return;
    }

    let isCancelled = false;

    getMemberForEdit(member.id)
      .then((fullMember) => {
        if (isCancelled) return;
        setForm((current) => ({
          ...current,
          ...toMemberFormState(fullMember),
        }));
        setFieldErrors({});
      })
      .catch((err) => {
        if (isCancelled) return;
        setError(err instanceof Error ? err.message : t("formError"));
      });

    return () => {
      isCancelled = true;
    };
  }, [open, isEditing, member?.id, t]);

  function updateForm<K extends keyof MemberFormState>(
    key: K,
    value: MemberFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setFieldErrors({});

    if (!isEditing && form.plan_id && !form.join_date) {
      setError(t("formError"));
      setFieldErrors({
        join_date: [t("joinedDateRequiredForSubscription")],
      });
      toast.error(t("formError"));
      setIsPending(false);
      return;
    }

    if (!isEditing && form.plan_id && !form.payment_amount.trim()) {
      setError(t("formError"));
      setFieldErrors({
        "payment.amount": [t("paymentAmountRequiredForSubscription")],
      });
      toast.error(t("formError"));
      setIsPending(false);
      return;
    }

    if (!isEditing && form.plan_id) {
      const paymentAmount = parseMoney(form.payment_amount);

      if (paymentAmount !== undefined && paymentAmount <= 0) {
        setError(t("formError"));
        setFieldErrors({
          "payment.amount": [t("paymentAmountMustBePositive")],
        });
        toast.error(t("formError"));
        setIsPending(false);
        return;
      }

      if (payableAmount !== undefined && paymentAmount !== undefined) {
        if (payableAmount < 0) {
          setError(t("formError"));
          setFieldErrors({
            discount: [t("discountCannotExceedPlanPrice")],
          });
          toast.error(t("formError"));
          setIsPending(false);
          return;
        }

        if (paymentAmount > payableAmount) {
          setError(t("formError"));
          setFieldErrors({
            "payment.amount": [
              t("paymentAmountExceedsBalance", {
                amount: formatMoney(payableAmount),
              }),
            ],
          });
          toast.error(t("formError"));
          setIsPending(false);
          return;
        }
      }
    }

    const data = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      gender: form.gender || undefined,
      birth_date: form.birth_date || undefined,
      national_id: form.national_id.trim() || undefined,
      join_date: form.join_date || undefined,
      notes: form.notes.trim() || undefined,
      ...(!isEditing && form.plan_id && form.join_date
        ? {
            subscription: {
              plan_id: Number(form.plan_id),
              start_date: form.join_date,
              discount: form.discount.trim() || "0.00",
              payment: {
                amount: form.payment_amount.trim(),
                method: form.payment_method,
              },
            },
          }
        : {}),
      ...(isEditing
        ? {
            status: form.status,
          }
        : {}),
    };

    console.groupCollapsed("[MemberFormDialog] submit payload");
    console.log("mode", mode);
    console.log("form state", form);
    console.log("request payload", data);
    console.groupEnd();

    try {
      if (isEditing && member) {
        await updateMember(member.id, data, locale as AppLocale);
      } else {
        await createMember(data, locale as AppLocale);
      }

      toast.success(
        isEditing ? t("memberUpdatedSuccess") : t("memberCreatedSuccess")
      );
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const parsedError = parseMemberActionError(err);

      if (parsedError) {
        setError(parsedError.message);
        setFieldErrors(normalizeMemberFieldErrors(parsedError.details ?? {}));
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

  const inputClass = cn(
    "h-9 w-full",
    isArabic ? "text-right" : "text-left"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={setPortalContainer}
        className={cn("max-w-lg", isArabic && "rtl")}
      >
        <DialogHeader className={cn(isArabic && "text-right")}>
          <DialogTitle>
            {isEditing ? t("editMemberTitle") : t("addMemberTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t("editMemberDescription") : t("addMemberDescription")}
          </DialogDescription>
        </DialogHeader>

        <form
          id="member-form"
          key={`${mode}-${member?.id ?? "new"}-${open ? "open" : "closed"}`}
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name" className={cn(isArabic && "justify-end")}>
                {t("formName")} *
              </Label>
              <Input
                id="name"
                name="name"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                required
                className={inputClass}
              />
              <FieldError messages={fieldErrors.name} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone" className={cn(isArabic && "justify-end")}>
                {t("formPhone")} *
              </Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={form.phone}
                onChange={(event) => updateForm("phone", event.target.value)}
                required
                className={inputClass}
              />
              <FieldError messages={fieldErrors.phone} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email" className={cn(isArabic && "justify-end")}>
                {t("formEmail")}
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={(event) => updateForm("email", event.target.value)}
                className={inputClass}
              />
              <FieldError messages={fieldErrors.email} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="gender" className={cn(isArabic && "justify-end")}>
                {t("formGender")}
              </Label>
              <select
                id="gender"
                name="gender"
                value={form.gender}
                onChange={(event) =>
                  updateForm("gender", event.target.value as "" | "male" | "female")
                }
                className={cn(
                  "h-9 w-full rounded-md border bg-card px-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50",
                  isArabic && "text-right"
                )}
              >
                <option value="">{t("formGenderPlaceholder")}</option>
                <option value="male">{t("filterGenderMale")}</option>
                <option value="female">{t("filterGenderFemale")}</option>
              </select>
              <FieldError messages={fieldErrors.gender} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="join_date" className={cn(isArabic && "justify-end")}>
                {t("formJoinedDate")}
              </Label>
              <DatePicker
                id="join_date"
                name="join_date"
                value={form.join_date}
                onChange={(date) => updateForm("join_date", date)}
                placeholder={t("formJoinedDatePlaceholder")}
                locale={locale}
                portalContainer={portalContainer}
                disabled={isPending}
                className={cn(isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.join_date} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="national_id" className={cn(isArabic && "justify-end")}>
                {t("formNationalId")}
              </Label>
              <Input
                id="national_id"
                name="national_id"
                value={form.national_id}
                onChange={(event) => updateForm("national_id", event.target.value)}
                className={inputClass}
              />
              <FieldError messages={fieldErrors.national_id} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="birth_date" className={cn(isArabic && "justify-end")}>
                {t("formBirthDate")}
              </Label>
              <DatePicker
                id="birth_date"
                name="birth_date"
                value={form.birth_date}
                onChange={(date) => updateForm("birth_date", date)}
                placeholder={t("formBirthDatePlaceholder")}
                locale={locale}
                portalContainer={portalContainer}
                disabled={isPending}
                className={cn(isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.birth_date} />
            </div>

            {isEditing && (
              <div className="space-y-1.5">
                <Label htmlFor="status" className={cn(isArabic && "justify-end")}>
                  {t("formStatus")}
                </Label>
                <select
                  id="status"
                  name="status"
                  value={form.status}
                  onChange={(event) =>
                    updateForm("status", event.target.value as "active" | "inactive")
                  }
                  className={cn(
                    "h-9 w-full rounded-md border bg-card px-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50",
                    isArabic && "text-right"
                  )}
                >
                  <option value="active">{t("statusActive")}</option>
                  <option value="inactive">{t("statusInactive")}</option>
                </select>
                <FieldError messages={fieldErrors.status} />
              </div>
            )}
          </div>

          {!isEditing && (
            <div className="space-y-4 rounded-lg border border-border/70 bg-muted/20 p-4">
              <div className="space-y-1">
                <p className={cn("text-sm font-bold", isArabic && "text-right")}>
                  {t("subscriptionSectionTitle")}
                </p>
                <p className={cn("text-xs text-muted-foreground", isArabic && "text-right")}>
                  {t("subscriptionSectionDescription")}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="plan_id" className={cn(isArabic && "justify-end")}>
                    {t("formSubscriptionType")}
                  </Label>
                  <select
                    id="plan_id"
                    name="plan_id"
                    value={form.plan_id}
                    onChange={(event) => updateForm("plan_id", event.target.value)}
                    className={cn(
                      "h-9 w-full rounded-md border bg-card px-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50",
                      isArabic && "text-right"
                    )}
                  >
                    <option value="">{t("formSubscriptionTypePlaceholder")}</option>
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
                  <Label htmlFor="expiration_preview" className={cn(isArabic && "justify-end")}>
                    {t("formExpirationDate")}
                  </Label>
                  <Input
                    id="expiration_preview"
                    value={
                      computedExpiryDate
                        ? formatDateLabel(computedExpiryDate, locale)
                        : t("formExpirationDatePlaceholder")
                    }
                    readOnly
                    className={cn(inputClass, "text-muted-foreground")}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="payment_amount" className={cn(isArabic && "justify-end")}>
                    {t("formPaymentAmount")}
                  </Label>
                  <Input
                    id="payment_amount"
                    name="payment_amount"
                    inputMode="decimal"
                    value={form.payment_amount}
                    onChange={(event) => updateForm("payment_amount", event.target.value)}
                    disabled={!form.plan_id}
                    className={inputClass}
                  />
                  <FieldError messages={fieldErrors["payment.amount"]} />
                  {payableAmount !== undefined && payableAmount >= 0 && (
                    <p className="text-xs text-muted-foreground">
                      {t("paymentBalanceHint", {
                        amount: formatMoney(payableAmount),
                      })}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="payment_method" className={cn(isArabic && "justify-end")}>
                    {t("formPaymentMethod")}
                  </Label>
                  <select
                    id="payment_method"
                    name="payment_method"
                    value={form.payment_method}
                    onChange={(event) =>
                      updateForm(
                        "payment_method",
                        event.target.value as "cash" | "card" | "bank_transfer"
                      )
                    }
                    disabled={!form.plan_id}
                    className={cn(
                      "h-9 w-full rounded-md border bg-card px-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50",
                      isArabic && "text-right"
                    )}
                  >
                    <option value="cash">{t("paymentMethodCash")}</option>
                    <option value="card">{t("paymentMethodCard")}</option>
                    <option value="bank_transfer">{t("paymentMethodBankTransfer")}</option>
                  </select>
                  <FieldError messages={fieldErrors["payment.method"]} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="discount" className={cn(isArabic && "justify-end")}>
                    {t("formDiscount")}
                  </Label>
                  <Input
                    id="discount"
                    name="discount"
                    inputMode="decimal"
                    value={form.discount}
                    onChange={(event) => updateForm("discount", event.target.value)}
                    disabled={!form.plan_id}
                    className={inputClass}
                  />
                  <FieldError messages={fieldErrors.discount} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="subscription_status_preview" className={cn(isArabic && "justify-end")}>
                    {t("tableHeaderSubscriptionStatus")}
                  </Label>
                  <Input
                    id="subscription_status_preview"
                    value={form.plan_id ? t("statusActive") : t("noSubscription")}
                    readOnly
                    className={cn(inputClass, "text-muted-foreground")}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="notes" className={cn(isArabic && "justify-end")}>
              {t("formNotes")}
            </Label>
            <Textarea
              id="notes"
              name="notes"
              value={form.notes}
              onChange={(event) => updateForm("notes", event.target.value)}
              rows={3}
              className={cn("w-full resize-none", isArabic && "text-right")}
            />
            <FieldError messages={fieldErrors.notes} />
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
          <Button
            type="submit"
            form="member-form"
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEditing ? t("formSave") : t("formAdd")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toMemberFormState(member?: Member | null): MemberFormState {
  return {
    name: member?.name ?? "",
    phone: member?.phone ?? "",
    email: member?.email ?? "",
    gender:
      member?.gender === "male" || member?.gender === "female"
        ? member.gender
        : "",
    birth_date: member?.birth_date ?? undefined,
    national_id: member?.national_id ?? "",
    join_date: member?.join_date ?? undefined,
    plan_id: "",
    discount: "0.00",
    payment_amount: "",
    payment_method: "cash",
    notes: member?.notes ?? "",
    status: member?.status === "inactive" ? "inactive" : "active",
  };
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-xs font-medium text-destructive">{messages[0]}</p>;
}

function parseMemberActionError(
  err: unknown
): { message: string; details?: Record<string, string[]> } | null {
  if (!(err instanceof Error)) {
    return null;
  }

  try {
    const parsed = JSON.parse(err.message) as {
      message?: string;
      details?: Record<string, string[]>;
    };

    if (parsed.message) {
      return {
        message: parsed.message,
        details: parsed.details,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeMemberFieldErrors(errors: Record<string, string[]>) {
  const normalized = { ...errors };
  const fieldMap: Record<string, string> = {
    "subscription.plan_id": "plan_id",
    "subscription.discount": "discount",
    "subscription.payment.amount": "payment.amount",
    "subscription.payment.method": "payment.method",
    amount: "payment.amount",
  };

  for (const [from, to] of Object.entries(fieldMap)) {
    if (normalized[from] && !normalized[to]) {
      normalized[to] = normalized[from];
    }
  }

  return normalized;
}

function parseMoney(value?: string) {
  if (!value?.trim()) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

function getPayableAmount(planPrice?: string, discount?: string) {
  const price = parseMoney(planPrice);
  const discountAmount = parseMoney(discount) ?? 0;

  if (price === undefined) {
    return undefined;
  }

  return price - discountAmount;
}

function formatMoney(value: number) {
  return value.toFixed(2);
}

function getComputedExpiryDate(
  joinedDate?: string,
  durationDays?: number
) {
  if (!joinedDate || !durationDays) {
    return undefined;
  }

  const startDate = new Date(joinedDate);
  if (Number.isNaN(startDate.getTime())) {
    return undefined;
  }

  startDate.setDate(startDate.getDate() + Number(durationDays));
  return startDate.toISOString().slice(0, 10);
}

function formatDateLabel(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(locale === "ar" ? "ar-EG" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
