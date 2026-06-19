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
import { generatePayroll } from "@/lib/actions/payroll";
import { cn } from "@/lib/utils";

export function PayrollGenerateDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("PayrollPage");
  const isArabic = locale === "ar";
  const [month, setMonth] = React.useState(new Date().toISOString().slice(0, 7));
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const result = z.string().regex(/^\d{4}-\d{2}$/, t("monthValidation")).safeParse(month);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? t("formError"));
      return;
    }

    setIsPending(true);
    try {
      const generated = await generatePayroll(month, locale as AppLocale);
      toast.success(t("payrollGeneratedSuccess", { count: generated.length }));
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      const parsed = parseActionError(err);
      const message = parsed?.message ?? (err instanceof Error ? err.message : t("formError"));
      setError(message);
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-md", isArabic && "rtl")}>
        <DialogHeader className={cn(isArabic && "text-right")}>
          <DialogTitle>{t("generateTitle")}</DialogTitle>
          <DialogDescription>{t("generateDescription")}</DialogDescription>
        </DialogHeader>
        <form id="generate-payroll-form" onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</div>}
          <div className="space-y-1.5">
            <Label htmlFor="month" className={cn(isArabic && "justify-end")}>{t("formMonth")} *</Label>
            <Input id="month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} disabled={isPending} className={cn("h-9", isArabic && "text-right")} />
          </div>
        </form>
        <DialogFooter className={cn("gap-2 sm:gap-2", isArabic && "flex-row-reverse")}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>{t("formCancel")}</Button>
          <Button type="submit" form="generate-payroll-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("formGenerate")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
