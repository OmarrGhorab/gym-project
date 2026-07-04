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
import { createProduct, updateProduct } from "@/lib/actions/products";
import type { Product } from "@/lib/api/dashboard";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/utils";

type ProductFormDialogProps = {
  mode: "add" | "edit";
  product?: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

type ProductFormState = {
  name: string;
  category: string;
  sku: string;
  price: string;
  cost: string;
  stock_quantity: string;
  low_stock_threshold: string;
  image?: File;
};

export function ProductFormDialog(props: ProductFormDialogProps) {
  const formKey = `${props.mode}-${props.product?.id ?? "new"}-${props.open ? "open" : "closed"}`;
  return <ProductFormDialogContent key={formKey} {...props} />;
}

function ProductFormDialogContent({
  mode,
  product,
  open,
  onOpenChange,
  onSuccess,
}: ProductFormDialogProps) {
  const locale = useLocale();
  const t = useTranslations("ProductsPage");
  const isArabic = locale === "ar";
  const isEditing = mode === "edit";
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [form, setForm] = React.useState<ProductFormState>(() => toProductFormState(product));

  function updateForm<K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setFieldErrors({});

    const validationErrors = validateProductForm({
      form,
      messages: {
        name: t("nameValidation"),
        category: t("categoryValidation"),
        sku: t("skuValidation"),
        price: t("priceValidation"),
        cost: t("costValidation"),
        stock: t("stockValidation"),
        image: t("imageValidation"),
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
      category: form.category.trim(),
      sku: form.sku.trim(),
      price: form.price.trim(),
      cost: form.cost.trim(),
      stock_quantity: Number(form.stock_quantity || 0),
      low_stock_threshold: Number(form.low_stock_threshold || 0),
      image: form.image,
    };

    try {
      if (isEditing && product) {
        await updateProduct(product.id, payload, locale as AppLocale);
      } else {
        await createProduct(payload, locale as AppLocale);
      }

      toast.success(isEditing ? t("productUpdatedSuccess") : t("productCreatedSuccess"));
      onOpenChange(false);
      onSuccess?.();
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

  const inputClass = cn("h-9 w-full", isArabic ? "text-right" : "text-left");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-xl", isArabic && "rtl")}>
        <DialogHeader className={cn(isArabic && "text-right")}>
          <DialogTitle>{isEditing ? t("editProductTitle") : t("addProductTitle")}</DialogTitle>
          <DialogDescription>
            {isEditing ? t("editProductDescription") : t("addProductDescription")}
          </DialogDescription>
        </DialogHeader>

        <form id="product-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label={t("formName")} required error={fieldErrors.name} isArabic={isArabic}>
              <Input id="name" value={form.name} onChange={(event) => updateForm("name", event.target.value)} disabled={isPending} className={inputClass} />
            </Field>
            <Field id="category" label={t("formCategory")} required error={fieldErrors.category} isArabic={isArabic}>
              <Input id="category" value={form.category} onChange={(event) => updateForm("category", event.target.value)} disabled={isPending} className={inputClass} />
            </Field>
            <Field id="sku" label={t("formSku")} required error={fieldErrors.sku} isArabic={isArabic}>
              <Input id="sku" value={form.sku} onChange={(event) => updateForm("sku", event.target.value)} disabled={isPending} className={inputClass} />
            </Field>
            <Field id="price" label={t("formPrice")} required error={fieldErrors.price} isArabic={isArabic}>
              <Input id="price" inputMode="decimal" value={form.price} onChange={(event) => updateForm("price", event.target.value)} disabled={isPending} className={inputClass} />
            </Field>
            <Field id="cost" label={t("formCost")} required error={fieldErrors.cost} isArabic={isArabic}>
              <Input id="cost" inputMode="decimal" value={form.cost} onChange={(event) => updateForm("cost", event.target.value)} disabled={isPending} className={inputClass} />
            </Field>
            <Field id="stock_quantity" label={t("formStock")} error={fieldErrors.stock_quantity} isArabic={isArabic}>
              <Input id="stock_quantity" inputMode="numeric" value={form.stock_quantity} onChange={(event) => updateForm("stock_quantity", event.target.value)} disabled={isPending} className={inputClass} />
            </Field>
            <Field id="low_stock_threshold" label={t("formThreshold")} error={fieldErrors.low_stock_threshold} isArabic={isArabic}>
              <Input id="low_stock_threshold" inputMode="numeric" value={form.low_stock_threshold} onChange={(event) => updateForm("low_stock_threshold", event.target.value)} disabled={isPending} className={inputClass} />
            </Field>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="image" className={cn(isArabic && "justify-end")}>
                {t("formImage")}
              </Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={(event) => updateForm("image", event.target.files?.[0])}
                disabled={isPending}
                className={cn("h-9 w-full", isArabic && "text-right")}
              />
              <FieldError messages={fieldErrors.image} />
              <p className="text-xs font-semibold text-muted-foreground">
                {form.image?.name ?? (product?.image ? t("formImageCurrent") : t("formImageHint"))}
              </p>
            </div>
          </div>
        </form>

        <DialogFooter className={cn("gap-2 sm:gap-2", isArabic && "flex-row-reverse")}>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            {t("formCancel")}
          </Button>
          <Button type="submit" form="product-form" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEditing ? t("formSave") : t("formAdd")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  required,
  error,
  isArabic,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string[];
  isArabic: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className={cn(isArabic && "justify-end")}>
        {label}{required ? " *" : ""}
      </Label>
      {children}
      <FieldError messages={error} />
    </div>
  );
}

function toProductFormState(product?: Product | null): ProductFormState {
  return {
    name: product?.name ?? "",
    category: product?.category ?? "",
    sku: product?.sku ?? "",
    price: product?.price ?? "",
    cost: product?.cost ?? "",
    stock_quantity: String(product?.stock_quantity ?? 0),
    low_stock_threshold: String(product?.low_stock_threshold ?? 0),
    image: undefined,
  };
}

function validateProductForm({
  form,
  messages,
}: {
  form: ProductFormState;
  messages: {
    name: string;
    category: string;
    sku: string;
    price: string;
    cost: string;
    stock: string;
    image: string;
  };
}) {
  const schema = z.object({
    name: z.string().trim().min(2, messages.name).max(191, messages.name),
    category: z.string().trim().min(2, messages.category).max(100, messages.category),
    sku: z.string().trim().min(2, messages.sku).max(100, messages.sku),
    price: z.string().trim().regex(/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/, messages.price).refine((value) => Number(value) > 0, messages.price),
    cost: z.string().trim().regex(/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/, messages.cost),
    stock_quantity: z.string().trim().regex(/^[0-9]+$/, messages.stock),
    low_stock_threshold: z.string().trim().regex(/^[0-9]+$/, messages.stock),
    image: z
      .instanceof(File)
      .optional()
      .refine((file) => !file || file.type.startsWith("image/"), messages.image)
      .refine((file) => !file || file.size <= 2 * 1024 * 1024, messages.image),
  });

  const result = schema.safeParse(form);
  if (result.success) return {};

  return Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), [issue.message]]));
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs font-medium text-destructive">{messages[0]}</p>;
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
