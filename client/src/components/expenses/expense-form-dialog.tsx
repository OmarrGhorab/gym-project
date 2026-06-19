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
import { Textarea } from "@/components/ui/textarea";
import type { AppLocale } from "@/i18n/routing";
import { createExpense, updateExpense } from "@/lib/actions/expenses";
import type { Expense } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

type ExpenseFormDialogProps = {
  mode: "add" | "edit";
  expense?: Expense | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type ExpenseFormState = {
  category: string;
  amount: string;
  date: string;
  description: string;
};

export function ExpenseFormDialog(props: ExpenseFormDialogProps) {
  const formKey = `${props.mode}-${props.expense?.id ?? "new"}-${props.open ? "open" : "closed"}`;

  return <ExpenseFormDialogContent key={formKey} {...props} />;
}

function ExpenseFormDialogContent({
  mode,
  expense,
  open,
  onOpenChange,
}: ExpenseFormDialogProps) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("ExpensesPage");
  const isArabic = locale === "ar";
  const isEditing = mode === "edit";
  const [portalContainer, setPortalContainer] = React.useState<HTMLDivElement | null>(null);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [form, setForm] = React.useState<ExpenseFormState>(() => ({
    category: expense?.category ?? "",
    amount: expense?.amount ?? "",
    date: expense?.date ?? new Date().toISOString().slice(0, 10),
    description: expense?.description ?? "",
  }));

  function updateForm<K extends keyof ExpenseFormState>(
    key: K,
    value: ExpenseFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setFieldErrors({});

    const validationErrors = validateExpenseForm({
      form,
      messages: {
        category: t("categoryValidation"),
        amount: t("amountValidation"),
        date: t("dateValidation"),
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
      category: form.category.trim(),
      amount: form.amount.trim(),
      date: form.date,
      description: form.description.trim() || null,
    };

    try {
      if (isEditing && expense) {
        await updateExpense(expense.id, payload, locale as AppLocale);
      } else {
        await createExpense(payload, locale as AppLocale);
      }
      toast.success(isEditing ? t("expenseUpdatedSuccess") : t("expenseCreatedSuccess"));
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
      <DialogContent ref={setPortalContainer} className={cn("max-w-xl", isArabic && "rtl")}>
        <DialogHeader className={cn(isArabic && "text-right")}>
          <DialogTitle>{isEditing ? t("editExpenseTitle") : t("addExpenseTitle")}</DialogTitle>
          <DialogDescription>
            {isEditing ? t("editExpenseDescription") : t("addExpenseDescription")}
          </DialogDescription>
        </DialogHeader>

        <form id="expense-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm font-semibold text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="category" className={cn(isArabic && "justify-end")}>
                {t("formCategory")} *
              </Label>
              <Input
                id="category"
                value={form.category}
                onChange={(event) => updateForm("category", event.target.value)}
                disabled={isPending}
                className={cn("h-9", isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.category} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount" className={cn(isArabic && "justify-end")}>
                {t("formAmount")} *
              </Label>
              <Input
                id="amount"
                inputMode="decimal"
                value={form.amount}
                onChange={(event) => updateForm("amount", event.target.value)}
                disabled={isPending}
                className={cn("h-9", isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.amount} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="date" className={cn(isArabic && "justify-end")}>
                {t("formDate")} *
              </Label>
              <DatePicker
                id="date"
                value={form.date}
                onChange={(date) => updateForm("date", date ?? "")}
                placeholder={t("formDatePlaceholder")}
                locale={locale}
                portalContainer={portalContainer}
                disabled={isPending}
                className={cn(isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.date} />
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
              className={cn("resize-none", isArabic && "text-right")}
            />
            <FieldError messages={fieldErrors.description} />
          </div>
        </form>

        <DialogFooter className={cn("gap-2 sm:gap-2", isArabic && "flex-row-reverse")}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("formCancel")}
          </Button>
          <Button type="submit" form="expense-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEditing ? t("formSave") : t("formAdd")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs font-medium text-destructive">{messages[0]}</p>;
}

function validateExpenseForm({
  form,
  messages,
}: {
  form: ExpenseFormState;
  messages: {
    category: string;
    amount: string;
    date: string;
    description: string;
  };
}) {
  const schema = z.object({
    category: z.string().trim().min(2, messages.category).max(255, messages.category),
    amount: z.string().trim().regex(/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/, messages.amount),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, messages.date),
    description: z.string().max(2000, messages.description),
  });

  const result = schema.safeParse(form);
  if (result.success) return {};

  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), [issue.message]])
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
    return parsed.message ? { message: parsed.message, details: parsed.details } : null;
  } catch {
    return null;
  }
}
