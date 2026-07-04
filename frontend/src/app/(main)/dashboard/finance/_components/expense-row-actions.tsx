"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { deleteExpense, updateExpense } from "./actions";
import { LedgerDatePicker } from "./ledger-date-picker";

export function ExpenseRowActions({
  amount,
  category,
  date,
  description,
  id,
  locale,
}: {
  amount: string;
  category: string;
  date: string;
  description: string | null;
  id: number;
  locale: string;
}) {
  const t = useTranslations("Dashboard.finance");
  const router = useRouter();
  const [pendingAction, setPendingAction] = React.useState<"delete" | "save" | null>(null);

  async function save(formData: FormData) {
    setPendingAction("save");
    const result = await updateExpense(formData);
    setPendingAction(null);

    if (result.ok) {
      toast.success(result.message);
      router.refresh();
      return;
    }

    toast.error(t("expenseNotSaved"), { description: result.message });
  }

  async function remove(formData: FormData) {
    setPendingAction("delete");
    const result = await deleteExpense(formData);
    setPendingAction(null);

    if (result.ok) {
      toast.success(result.message);
      router.refresh();
      return;
    }

    toast.error(t("expenseNotDeleted"), { description: result.message });
  }

  return (
    <form
      action={save}
      className="grid w-full min-w-[650px] grid-cols-[minmax(12rem,1fr)_7.5rem_8.5rem_auto_auto] items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <Input name="category" defaultValue={category} aria-label={t("category")} />
      <Input name="amount" type="number" min="0.01" step="0.01" defaultValue={amount} aria-label={t("amount")} />
      <LedgerDatePicker name="date" value={date} locale={locale} />
      <input type="hidden" name="description" value={description ?? ""} />
      <Button type="submit" size="sm" disabled={pendingAction !== null} className="min-w-16">
        {pendingAction === "save" ? t("saving") : t("save")}
      </Button>
      <Button
        formAction={remove}
        type="submit"
        size="sm"
        variant="outline"
        disabled={pendingAction !== null}
        className="min-w-20"
      >
        {pendingAction === "delete" ? t("deleting") : t("delete")}
      </Button>
    </form>
  );
}
