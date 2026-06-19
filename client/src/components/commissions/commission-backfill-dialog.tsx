"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { backfillCommissions } from "@/lib/actions/commissions";
import { cn } from "@/lib/utils";

export function CommissionBackfillDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations("CommissionsPage");
  const isArabic = locale === "ar";
  const [portalContainer, setPortalContainer] = React.useState<HTMLDivElement | null>(null);
  const [from, setFrom] = React.useState(() => daysAgo(90));
  const [to, setTo] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [dryRun, setDryRun] = React.useState(true);
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const schema = z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("dateValidation")),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t("dateValidation")),
    }).refine((data) => data.to >= data.from, {
      path: ["to"],
      message: t("dateRangeValidation"),
    });
    const result = schema.safeParse({ from, to });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? t("formError"));
      return;
    }

    setIsPending(true);
    try {
      const response = await backfillCommissions({ from, to, dry_run: dryRun }, locale as AppLocale);
      toast.success(t("backfillSuccess", { count: Number(response.created ?? response.processed ?? 0) }));
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
      <DialogContent ref={setPortalContainer} className={cn("max-w-lg", isArabic && "rtl")}>
        <DialogHeader className={cn(isArabic && "text-right")}>
          <DialogTitle>{t("backfillTitle")}</DialogTitle>
          <DialogDescription>{t("backfillDescription")}</DialogDescription>
        </DialogHeader>
        <form id="commission-backfill-form" onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-md bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</div>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className={cn(isArabic && "justify-end")}>{t("fromLabel")}</Label>
              <DatePicker value={from} onChange={(date) => setFrom(date ?? "")} locale={locale} portalContainer={portalContainer} placeholder={t("fromPlaceholder")} disabled={isPending} />
            </div>
            <div className="space-y-1.5">
              <Label className={cn(isArabic && "justify-end")}>{t("toLabel")}</Label>
              <DatePicker value={to} onChange={(date) => setTo(date ?? "")} locale={locale} portalContainer={portalContainer} placeholder={t("toPlaceholder")} disabled={isPending} />
            </div>
          </div>
          <label className={cn("flex items-center gap-3 rounded-lg border bg-muted/20 p-3 text-sm font-semibold text-foreground", isArabic && "flex-row-reverse text-right")}>
            <Checkbox checked={dryRun} onCheckedChange={(checked) => setDryRun(checked === true)} disabled={isPending} />
            <span>{t("dryRunLabel")}</span>
          </label>
        </form>
        <DialogFooter className={cn("gap-2 sm:gap-2", isArabic && "flex-row-reverse")}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>{t("formCancel")}</Button>
          <Button type="submit" form="commission-backfill-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("formBackfill")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
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
