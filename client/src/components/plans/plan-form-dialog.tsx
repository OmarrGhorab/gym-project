"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPlan, updatePlan } from "@/lib/actions/plans";
import type { Plan } from "@/lib/api/dashboard";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type PlanFormDialogProps = {
  mode: "add" | "edit";
  plan?: Plan | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

type PlanFormState = {
  name: string;
  description: string;
  price: string;
  duration_days: string;
  sessions_count: string;
  type: "membership" | "offer";
  is_active: boolean;
  valid_from?: string;
  valid_to?: string;
  max_freeze_days: string;
};

export function PlanFormDialog(props: PlanFormDialogProps) {
  const formKey = `${props.mode}-${props.plan?.id ?? "new"}-${props.open ? "open" : "closed"}`;

  return <PlanFormDialogContent key={formKey} {...props} />;
}

function PlanFormDialogContent({
  mode,
  plan,
  open,
  onOpenChange,
  onSuccess,
}: PlanFormDialogProps) {
  const locale = useLocale();
  const t = useTranslations("PlansPage");
  const isArabic = locale === "ar";
  const isEditing = mode === "edit";
  const [portalContainer, setPortalContainer] = React.useState<HTMLDivElement | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [form, setForm] = React.useState<PlanFormState>(() => toPlanFormState(plan));

  function updateForm<K extends keyof PlanFormState>(
    key: K,
    value: PlanFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setFieldErrors({});

    const validationErrors = validatePlanForm({
      form,
      messages: {
        name: t("nameValidation"),
        price: t("priceValidation"),
        duration: t("durationValidation"),
        sessions: t("sessionsValidation"),
        dates: t("datesValidation"),
        freeze: t("freezeValidation"),
        description: t("descriptionValidation"),
      },
    });

    if (Object.keys(validationErrors).length > 0) {
      setError(t("formError"));
      setFieldErrors(validationErrors);
      toast.error(t("formError"));
      setIsPending(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      price: form.price.trim(),
      duration_days: Number(form.duration_days),
      sessions_count: form.sessions_count.trim() ? Number(form.sessions_count) : null,
      type: form.type,
      is_active: form.is_active,
      valid_from: form.valid_from || null,
      valid_to: form.valid_to || null,
      max_freeze_days: Number(form.max_freeze_days || 0),
    };

    try {
      if (isEditing && plan) {
        await updatePlan(plan.id, payload, locale as AppLocale);
      } else {
        await createPlan(payload, locale as AppLocale);
      }

      toast.success(isEditing ? t("planUpdatedSuccess") : t("planCreatedSuccess"));
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const parsedError = parsePlanActionError(err);

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

  const inputClass = cn("h-9 w-full", isArabic ? "text-right" : "text-left");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={setPortalContainer}
        className={cn("max-w-2xl", isArabic && "rtl")}
      >
        <DialogHeader className={cn(isArabic && "text-right")}>
          <DialogTitle>
            {isEditing ? t("editPlanTitle") : t("addPlanTitle")}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? t("editPlanDescription") : t("addPlanDescription")}
          </DialogDescription>
        </DialogHeader>

        <form id="plan-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name" className={cn(isArabic && "justify-end")}>
                {t("formName")} *
              </Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                disabled={isPending}
                className={inputClass}
              />
              <FieldError messages={fieldErrors.name} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="type" className={cn(isArabic && "justify-end")}>
                {t("formType")} *
              </Label>
              <select
                id="type"
                value={form.type}
                onChange={(event) => updateForm("type", event.target.value as "membership" | "offer")}
                disabled={isPending}
                className={cn(
                  "h-9 w-full rounded-md border bg-card px-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50",
                  isArabic && "text-right"
                )}
              >
                <option value="membership">{t("typeMembership")}</option>
                <option value="offer">{t("typeOffer")}</option>
              </select>
              <FieldError messages={fieldErrors.type} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="price" className={cn(isArabic && "justify-end")}>
                {t("formPrice")} *
              </Label>
              <Input
                id="price"
                inputMode="decimal"
                value={form.price}
                onChange={(event) => updateForm("price", event.target.value)}
                disabled={isPending}
                className={inputClass}
              />
              <FieldError messages={fieldErrors.price} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="duration_days" className={cn(isArabic && "justify-end")}>
                {t("formDuration")} *
              </Label>
              <Input
                id="duration_days"
                inputMode="numeric"
                value={form.duration_days}
                onChange={(event) => updateForm("duration_days", event.target.value)}
                disabled={isPending}
                className={inputClass}
              />
              <FieldError messages={fieldErrors.duration_days} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sessions_count" className={cn(isArabic && "justify-end")}>
                {t("formSessions")}
              </Label>
              <Input
                id="sessions_count"
                inputMode="numeric"
                value={form.sessions_count}
                onChange={(event) => updateForm("sessions_count", event.target.value)}
                disabled={isPending}
                className={inputClass}
              />
              <FieldError messages={fieldErrors.sessions_count} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="max_freeze_days" className={cn(isArabic && "justify-end")}>
                {t("formFreezeDays")}
              </Label>
              <Input
                id="max_freeze_days"
                inputMode="numeric"
                value={form.max_freeze_days}
                onChange={(event) => updateForm("max_freeze_days", event.target.value)}
                disabled={isPending}
                className={inputClass}
              />
              <FieldError messages={fieldErrors.max_freeze_days} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="valid_from" className={cn(isArabic && "justify-end")}>
                {t("formValidFrom")}
              </Label>
              <DatePicker
                id="valid_from"
                value={form.valid_from}
                onChange={(date) => updateForm("valid_from", date)}
                placeholder={t("formValidFromPlaceholder")}
                locale={locale}
                portalContainer={portalContainer}
                disabled={isPending}
                className={cn(isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.valid_from} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="valid_to" className={cn(isArabic && "justify-end")}>
                {t("formValidTo")}
              </Label>
              <DatePicker
                id="valid_to"
                value={form.valid_to}
                onChange={(date) => updateForm("valid_to", date)}
                placeholder={t("formValidToPlaceholder")}
                locale={locale}
                portalContainer={portalContainer}
                disabled={isPending}
                className={cn(isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.valid_to} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description" className={cn(isArabic && "justify-end")}>
              {t("formDescription")}
            </Label>
            <Textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(event) => updateForm("description", event.target.value)}
              disabled={isPending}
              className={cn("w-full resize-none", isArabic && "text-right")}
            />
            <FieldError messages={fieldErrors.description} />
          </div>

          <label
            className={cn(
              "flex items-center gap-3 rounded-lg border bg-muted/20 p-3 text-sm font-semibold text-foreground",
              isArabic && "flex-row-reverse text-right"
            )}
          >
            <Checkbox
              checked={form.is_active}
              onCheckedChange={(checked) => updateForm("is_active", checked === true)}
              disabled={isPending}
            />
            <span>{t("formActive")}</span>
          </label>
        </form>

        <DialogFooter className={cn("gap-2 sm:gap-2", isArabic && "flex-row-reverse")}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("formCancel")}
          </Button>
          <Button type="submit" form="plan-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEditing ? t("formSave") : t("formAdd")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function toPlanFormState(plan?: Plan | null): PlanFormState {
  return {
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    price: plan?.price ?? "",
    duration_days: plan?.duration_days ? String(plan.duration_days) : "",
    sessions_count: plan?.sessions_count ? String(plan.sessions_count) : "",
    type: plan?.type ?? "membership",
    is_active: plan?.is_active ?? true,
    valid_from: plan?.valid_from ?? undefined,
    valid_to: plan?.valid_to ?? undefined,
    max_freeze_days: String(plan?.max_freeze_days ?? 0),
  };
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) {
    return null;
  }

  return <p className="text-xs font-medium text-destructive">{messages[0]}</p>;
}

function parsePlanActionError(
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

function validatePlanForm({
  form,
  messages,
}: {
  form: PlanFormState;
  messages: {
    name: string;
    price: string;
    duration: string;
    sessions: string;
    dates: string;
    freeze: string;
    description: string;
  };
}) {
  const schema = z
    .object({
      name: z.string().trim().min(2, messages.name).max(150, messages.name),
      description: z.string().max(2000, messages.description),
      price: z.string().trim().regex(/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/, messages.price),
      duration_days: z.string().trim().regex(/^[1-9][0-9]*$/, messages.duration),
      sessions_count: z
        .string()
        .trim()
        .optional()
        .refine((value) => !value || /^[1-9][0-9]*$/.test(value), {
          message: messages.sessions,
        }),
      type: z.union([z.literal("membership"), z.literal("offer")]),
      is_active: z.boolean(),
      valid_from: z.string().optional(),
      valid_to: z.string().optional(),
      max_freeze_days: z
        .string()
        .trim()
        .regex(/^[0-9]+$/, messages.freeze),
    })
    .superRefine((data, ctx) => {
      const durationDays = Number(data.duration_days);
      const maxFreezeDays = Number(data.max_freeze_days);

      if (maxFreezeDays > durationDays) {
        ctx.addIssue({
          code: "custom",
          path: ["max_freeze_days"],
          message: messages.freeze,
        });
      }

      if (
        data.valid_from &&
        data.valid_to &&
        isIsoDate(data.valid_from) &&
        isIsoDate(data.valid_to) &&
        data.valid_to.localeCompare(data.valid_from) < 0
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["valid_to"],
          message: messages.dates,
        });
      }

      if (data.valid_from && !isIsoDate(data.valid_from)) {
        ctx.addIssue({
          code: "custom",
          path: ["valid_from"],
          message: messages.dates,
        });
      }

      if (data.valid_to && !isIsoDate(data.valid_to)) {
        ctx.addIssue({
          code: "custom",
          path: ["valid_to"],
          message: messages.dates,
        });
      }
    });

  const result = schema.safeParse(form);

  if (result.success) {
    return {};
  }

  return Object.fromEntries(
    result.error.issues.map((issue) => [
      issue.path.join("."),
      [issue.message],
    ])
  );
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}
