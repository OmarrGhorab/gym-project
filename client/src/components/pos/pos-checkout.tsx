"use client";

import * as React from "react";
import { Minus, Plus, Search, ShoppingCart, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { createSale } from "@/lib/actions/sales";
import type { AppLocale } from "@/i18n/routing";
import type { Product } from "@/lib/api/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type CartItem = {
  product: Product;
  quantity: number;
};

export function PosCheckout({ products }: { products: Product[] }) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("PosPage");
  const isArabic = locale === "ar";
  const [query, setQuery] = React.useState("");
  const [cart, setCart] = React.useState<CartItem[]>([]);
  const [memberId, setMemberId] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<"cash" | "card" | "bank_transfer">("cash");
  const [discount, setDiscount] = React.useState("0");
  const [notes, setNotes] = React.useState("");
  const [isPending, setIsPending] = React.useState(false);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});

  const filteredProducts = React.useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products
      .filter((product) => product.is_active && product.stock_quantity > 0)
      .filter((product) => {
        if (!normalizedQuery) return true;
        return (
          product.name.toLowerCase().includes(normalizedQuery) ||
          product.sku.toLowerCase().includes(normalizedQuery) ||
          product.category.toLowerCase().includes(normalizedQuery)
        );
      });
  }, [products, query]);

  const subtotal = cart.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
  const discountAmount = parseMoney(discount) ?? 0;
  const total = Math.max(0, subtotal - discountAmount);

  function addProduct(product: Product) {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock_quantity) }
            : item
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  }

  function updateQuantity(productId: number, quantity: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.min(Math.max(quantity, 1), item.product.stock_quantity) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeProduct(productId: number) {
    setCart((current) => current.filter((item) => item.product.id !== productId));
  }

  async function handleCheckout() {
    setFieldErrors({});
    const schema = z.object({
      member_id: z
        .string()
        .trim()
        .optional()
        .refine((value) => !value || /^[1-9][0-9]*$/.test(value), t("memberValidation")),
      discount: z
        .string()
        .trim()
        .optional()
        .refine((value) => !value || /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/.test(value), t("discountValidation")),
      notes: z.string().max(500, t("notesValidation")),
    }).superRefine((data, ctx) => {
      if (cart.length === 0) {
        ctx.addIssue({ code: "custom", path: ["items"], message: t("itemsValidation") });
      }
      const parsedDiscount = parseMoney(data.discount);
      if (parsedDiscount !== undefined && parsedDiscount >= subtotal) {
        ctx.addIssue({ code: "custom", path: ["discount"], message: t("discountTooHigh") });
      }
    });

    const result = schema.safeParse({ member_id: memberId, discount, notes });
    if (!result.success) {
      setFieldErrors(Object.fromEntries(result.error.issues.map((issue) => [issue.path.join("."), [issue.message]])));
      toast.error(t("formError"));
      return;
    }

    setIsPending(true);
    try {
      await createSale(
        {
          idempotency_key: crypto.randomUUID(),
          member_id: memberId.trim() ? Number(memberId) : undefined,
          payment_method: paymentMethod,
          discount: discount.trim() || "0",
          notes: notes.trim() || undefined,
          items: cart.map((item) => ({
            product_id: item.product.id,
            quantity: item.quantity,
          })),
        },
        locale as AppLocale
      );

      toast.success(t("saleCreatedSuccess"));
      setCart([]);
      setDiscount("0");
      setMemberId("");
      setNotes("");
      router.refresh();
    } catch (err) {
      const parsed = parseActionError(err);
      if (parsed?.details) {
        setFieldErrors(parsed.details);
      }
      toast.error(parsed?.message ?? (err instanceof Error ? err.message : t("formError")));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="space-y-4">
        <div className="relative">
          <div className={cn("pointer-events-none absolute inset-y-0 flex items-center text-muted-foreground", isArabic ? "right-3" : "left-3")}>
            <Search className="size-4" />
          </div>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className={cn("h-10 bg-card shadow-sm", isArabic ? "pr-9 text-right" : "pl-9 text-left")}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => addProduct(product)}
              className={cn(
                "rounded-lg border bg-card p-4 text-left shadow-sm transition hover:border-primary/50 hover:bg-muted/20",
                isArabic && "text-right"
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-foreground">{product.name}</p>
                  <p className="text-xs font-semibold text-muted-foreground">{product.sku}</p>
                </div>
                <Badge variant="outline" className="rounded-md text-xs font-bold">
                  {product.category}
                </Badge>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <p className="text-xl font-black text-foreground tabular-nums">
                  {formatCurrency(product.price, locale)}
                </p>
                <p className={cn("text-xs font-bold tabular-nums", product.is_low_stock ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                  {t("stockCount", { count: product.stock_quantity })}
                </p>
              </div>
            </button>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="rounded-lg border bg-card p-10 text-center text-sm font-semibold text-muted-foreground">
            {t("emptyProducts")}
          </div>
        )}
      </section>

      <aside className="rounded-lg border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className={cn(isArabic && "text-right")}>
            <h2 className="text-base font-black text-foreground">{t("cartTitle")}</h2>
            <p className="text-xs font-semibold text-muted-foreground">
              {t("cartDescription", { count: cart.length })}
            </p>
          </div>
          <ShoppingCart className="size-5 text-primary" />
        </div>

        <div className="max-h-[360px] space-y-2 overflow-y-auto p-4">
          {cart.map((item) => (
            <div key={item.product.id} className="rounded-lg border bg-muted/15 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className={cn(isArabic && "text-right")}>
                  <p className="text-sm font-bold text-foreground">{item.product.name}</p>
                  <p className="text-xs font-semibold text-muted-foreground">
                    {formatCurrency(item.product.price, locale)}
                  </p>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeProduct(item.product.id)} title={t("removeItem")}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon-sm" onClick={() => updateQuantity(item.product.id, item.quantity - 1)}>
                    <Minus className="size-3.5" />
                  </Button>
                  <span className="grid h-7 min-w-8 place-items-center rounded-md border bg-background px-2 text-xs font-black tabular-nums">
                    {item.quantity}
                  </span>
                  <Button type="button" variant="outline" size="icon-sm" onClick={() => updateQuantity(item.product.id, item.quantity + 1)}>
                    <Plus className="size-3.5" />
                  </Button>
                </div>
                <p className="text-sm font-black text-foreground tabular-nums">
                  {formatCurrency(Number(item.product.price) * item.quantity, locale)}
                </p>
              </div>
            </div>
          ))}

          {cart.length === 0 && (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm font-semibold text-muted-foreground">
              {t("emptyCart")}
            </div>
          )}
          <FieldError messages={fieldErrors.items} />
        </div>

        <div className="space-y-3 border-t p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="space-y-1.5">
              <Label htmlFor="member_id" className={cn(isArabic && "justify-end")}>{t("memberId")}</Label>
              <Input id="member_id" inputMode="numeric" value={memberId} onChange={(event) => setMemberId(event.target.value)} className={cn(isArabic && "text-right")} />
              <FieldError messages={fieldErrors.member_id} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment_method" className={cn(isArabic && "justify-end")}>{t("paymentMethod")}</Label>
              <select
                id="payment_method"
                value={paymentMethod}
                onChange={(event) => setPaymentMethod(event.target.value as "cash" | "card" | "bank_transfer")}
                className={cn("h-9 w-full rounded-md border bg-card px-2 text-sm shadow-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/50", isArabic && "text-right")}
              >
                <option value="cash">{t("paymentCash")}</option>
                <option value="card">{t("paymentCard")}</option>
                <option value="bank_transfer">{t("paymentBank")}</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="discount" className={cn(isArabic && "justify-end")}>{t("discount")}</Label>
            <Input id="discount" inputMode="decimal" value={discount} onChange={(event) => setDiscount(event.target.value)} className={cn(isArabic && "text-right")} />
            <FieldError messages={fieldErrors.discount} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className={cn(isArabic && "justify-end")}>{t("notes")}</Label>
            <Textarea id="notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} className={cn("resize-none", isArabic && "text-right")} />
            <FieldError messages={fieldErrors.notes} />
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
            <SummaryRow label={t("subtotal")} value={formatCurrency(subtotal, locale)} />
            <SummaryRow label={t("discount")} value={formatCurrency(discountAmount, locale)} />
            <div className="flex items-center justify-between border-t pt-2">
              <span className="text-sm font-black text-foreground">{t("total")}</span>
              <span className="text-xl font-black text-foreground tabular-nums">{formatCurrency(total, locale)}</span>
            </div>
          </div>

          <Button type="button" className="w-full" size="lg" onClick={handleCheckout} disabled={isPending}>
            {isPending ? t("checkoutLoading") : t("checkout")}
          </Button>
        </div>
      </aside>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs font-medium text-destructive">{messages[0]}</p>;
}

function parseMoney(value?: string) {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatCurrency(value: string | number, locale: string) {
  const amount = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(amount)) return "-";
  return amount.toLocaleString(locale === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  });
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
