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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { adjustProductStock } from "@/lib/actions/products";
import type { Product } from "@/lib/api/dashboard";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export function StockAdjustDialog({
  product,
  open,
  onOpenChange,
  onSuccess,
}: {
  product?: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const dialogKey = `${product?.id ?? "none"}-${open ? "open" : "closed"}`;

  return (
    <StockAdjustDialogContent
      key={dialogKey}
      product={product}
      open={open}
      onOpenChange={onOpenChange}
      onSuccess={onSuccess}
    />
  );
}

function StockAdjustDialogContent({
  product,
  open,
  onOpenChange,
  onSuccess,
}: {
  product?: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}) {
  const locale = useLocale();
  const t = useTranslations("ProductsPage");
  const isArabic = locale === "ar";
  const [isPending, setIsPending] = React.useState(false);
  const [type, setType] = React.useState<"in" | "out">("in");
  const [quantity, setQuantity] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product) return;

    setIsPending(true);
    setFieldErrors({});

    const schema = z.object({
      type: z.union([z.literal("in"), z.literal("out")]),
      quantity: z.string().trim().regex(/^[1-9][0-9]*$/, t("stockQuantityValidation")),
      reason: z.string().trim().min(3, t("stockReasonValidation")).max(255, t("stockReasonValidation")),
    });
    const result = schema.safeParse({ type, quantity, reason });

    if (!result.success) {
      setFieldErrors(Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), [issue.message]])));
      toast.error(t("formError"));
      setIsPending(false);
      return;
    }

    try {
      await adjustProductStock(
        product.id,
        {
          type,
          quantity: Number(quantity),
          reason: reason.trim(),
        },
        locale as AppLocale
      );
      toast.success(t("stockAdjustedSuccess"));
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("formError"));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-md", isArabic && "rtl")}>
        <DialogHeader className={cn(isArabic && "text-right")}>
          <DialogTitle>{t("stockTitle")}</DialogTitle>
          <DialogDescription>
            {product ? t("stockDescription", { name: product.name }) : t("stockDescriptionFallback")}
          </DialogDescription>
        </DialogHeader>

        <form id="stock-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="stock_type" className={cn(isArabic && "justify-end")}>
              {t("stockType")}
            </Label>
            <select
              id="stock_type"
              value={type}
              onChange={(event) => setType(event.target.value as "in" | "out")}
              disabled={isPending}
              className={cn(
                "h-9 w-full rounded-md border bg-card px-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50",
                isArabic && "text-right"
              )}
            >
              <option value="in">{t("stockIn")}</option>
              <option value="out">{t("stockOut")}</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stock_quantity" className={cn(isArabic && "justify-end")}>
              {t("stockQuantity")}
            </Label>
            <Input
              id="stock_quantity"
              inputMode="numeric"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              disabled={isPending}
              className={cn(isArabic && "text-right")}
            />
            <FieldError messages={fieldErrors.quantity} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="stock_reason" className={cn(isArabic && "justify-end")}>
              {t("stockReason")}
            </Label>
            <Input
              id="stock_reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={isPending}
              className={cn(isArabic && "text-right")}
            />
            <FieldError messages={fieldErrors.reason} />
          </div>
        </form>

        <DialogFooter className={cn("gap-2 sm:gap-2", isArabic && "flex-row-reverse")}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("formCancel")}
          </Button>
          <Button type="submit" form="stock-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t("stockSave")}
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
