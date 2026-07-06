"use client";

import * as React from "react";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { FormSelect } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";

import { type FinanceActionResult, recordPayment } from "./actions";

export function DuePaymentForm({ amount, subscriptionId }: { amount: number | string; subscriptionId: number }) {
  const t = useTranslations("Dashboard.finance");
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<FinanceActionResult["errors"]>({});

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await recordPayment(formData);
      setErrors(result.errors ?? {});

      if (result.ok) {
        toast.success(result.message);
        return;
      }

      toast.error(result.message);
    });
  }

  return (
    <form action={submit} className="grid justify-end gap-1">
      <div className="flex justify-end gap-2">
        <input type="hidden" name="subscription_id" value={subscriptionId} />
        <Input
          className="h-8 w-24"
          name="amount"
          type="number"
          min="0.01"
          step="0.01"
          defaultValue={amount}
          aria-label={t("amount")}
          aria-invalid={Boolean(errors?.amount?.[0])}
        />
        <FormSelect
          className="w-28"
          name="method"
          defaultValue="cash"
          size="sm"
          error={errors?.method?.[0]}
          options={[
            { value: "cash", label: t("paymentMethods.cash") },
            { value: "card", label: t("paymentMethods.card") },
            { value: "bank_transfer", label: t("paymentMethods.bank_transfer") },
          ]}
        />
        <Button type="submit" size="sm" disabled={pending}>
          {t("collect")}
        </Button>
      </div>
      <FieldError errors={[...(errors?.subscription_id ?? []), ...(errors?.amount ?? [])]} />
    </form>
  );
}
