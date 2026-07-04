"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { format, parseISO } from "date-fns";
import { CalendarIcon, ImagePlus, PackagePlus, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import {
  adjustProductStock,
  createProduct,
  createPurchaseOrder,
  deleteProduct,
  receivePurchaseOrder,
  toggleProduct,
  updateProduct,
} from "./actions";
import type { InventoryProduct, PurchaseOrder } from "./shipment-data";

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="grid gap-2">
      <div className="font-medium text-sm">{label}</div>
      {children}
    </div>
  );
}

function formatDateString(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function formatDateLabel(value: string, locale: string, fallback: string) {
  if (!value) return fallback;

  const date = parseISO(value);

  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function parseDateString(value: string) {
  if (!value) return undefined;

  const date = parseISO(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function DatePickerField({ name }: { name: string }) {
  const t = useTranslations("Dashboard.logistics");
  const locale = useLocale();
  const [value, setValue] = React.useState("");
  const selectedDate = parseDateString(value);

  return (
    <Field label={t("expectedDate")}>
      <Popover>
        <PopoverTrigger
          render={
            <Button type="button" variant="outline" className="w-full justify-between font-normal">
              {formatDateLabel(value, locale, t("selectDate"))}
              <CalendarIcon data-icon="inline-end" className="text-muted-foreground" />
            </Button>
          }
        />
        <PopoverContent align="start" className="w-auto overflow-hidden p-0">
          <Calendar
            mode="single"
            selected={selectedDate}
            defaultMonth={selectedDate}
            onSelect={(date) => {
              if (date) setValue(formatDateString(date));
            }}
          />
        </PopoverContent>
      </Popover>
      <input name={name} type="hidden" value={value} />
    </Field>
  );
}

export function AddProductDialog() {
  const t = useTranslations("Dashboard.logistics");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createProduct(formData);

      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
        return;
      }

      toast.error(t("productNotCreated"), { description: result.message });
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <PackagePlus />
        {t("addProduct")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("addProductTitle")}</DialogTitle>
          <DialogDescription>{t("addProductDescription")}</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("name")}>
              <Input name="name" required placeholder={t("namePlaceholder")} />
            </Field>
            <Field label={t("category")}>
              <Input name="category" required placeholder={t("categoryPlaceholder")} />
            </Field>
            <Field label={t("sku")}>
              <Input name="sku" required placeholder={t("skuPlaceholder")} />
            </Field>
            <Field label={t("image")}>
              <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1">
                <ImagePlus className="size-4 text-muted-foreground" />
                <Input name="image" type="file" accept="image/*" className="border-0 px-0 focus-visible:ring-0" />
              </div>
            </Field>
            <Field label={t("salePrice")}>
              <Input name="price" required type="number" min="0.01" step="0.01" placeholder="150" />
            </Field>
            <Field label={t("cost")}>
              <Input name="cost" required type="number" min="0" step="0.01" placeholder="90" />
            </Field>
            <Field label={t("openingStock")}>
              <Input name="stock_quantity" type="number" min="0" defaultValue="0" />
            </Field>
            <Field label={t("lowStockThreshold")}>
              <Input name="low_stock_threshold" type="number" min="0" defaultValue="5" />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("saving") : t("createProduct")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreatePurchaseOrderDialog({ products }: { products?: InventoryProduct[] }) {
  const t = useTranslations("Dashboard.logistics");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const safeProducts = products ?? [];
  const defaultProduct = safeProducts[0];

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createPurchaseOrder(formData);

      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
        return;
      }

      toast.error(t("purchaseOrderNotCreated"), { description: result.message });
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" disabled={safeProducts.length === 0} />}>
        <Truck />
        {t("createPo")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("createPurchaseOrder")}</DialogTitle>
          <DialogDescription>{t("createPurchaseOrderDescription")}</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <Field label={t("supplier")}>
            <Input name="supplier_name" required placeholder={t("supplierPlaceholder")} />
          </Field>
          <Field label={t("supplierPhone")}>
            <Input name="supplier_phone" placeholder="+20..." />
          </Field>
          <Field label={t("image")}>
            <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1">
              <ImagePlus className="size-4 text-muted-foreground" />
              <Input name="image" type="file" accept="image/*" className="border-0 px-0 focus-visible:ring-0" />
            </div>
          </Field>
          <Field label={t("product")}>
            <Select name="product_id" defaultValue={defaultProduct ? String(defaultProduct.id) : undefined}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("selectProduct")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {safeProducts.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.name} · {t("left", { count: product.stock_quantity })}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t("quantity")}>
              <Input name="quantity_ordered" required type="number" min="1" defaultValue="1" />
            </Field>
            <Field label={t("unitCost")}>
              <Input
                name="unit_cost"
                required
                type="number"
                min="0"
                step="0.01"
                defaultValue={defaultProduct?.cost ?? "0"}
              />
            </Field>
            <DatePickerField name="expected_at" />
          </div>
          <Field label={t("notes")}>
            <Textarea name="notes" placeholder={t("notesPlaceholder")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending || safeProducts.length === 0}>
              {pending ? t("saving") : t("createOrder")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProductQuickActions({ compact = false, product }: { compact?: boolean; product: InventoryProduct }) {
  const t = useTranslations("Dashboard.logistics");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function run(action: (formData: FormData) => Promise<{ ok: boolean; message: string }>, formData: FormData) {
    startTransition(async () => {
      const result = await action(formData);

      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        return;
      }

      toast.error(t("actionFailed"), { description: result.message });
    });
  }

  return (
    <div className={compact ? "grid gap-2" : "grid gap-3"}>
      <form action={(formData) => run(adjustProductStock, formData)} className="grid grid-cols-[96px_1fr_auto] gap-2">
        <input type="hidden" name="id" value={product.id} />
        <Field label={t("type")}>
          <Select name="type" defaultValue="in">
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in">{t("stockIn")}</SelectItem>
              <SelectItem value="out">{t("stockOut")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label={t("quantity")}>
          <Input name="quantity" type="number" min="1" defaultValue="1" className="h-8" />
        </Field>
        <input type="hidden" name="reason" value={t("manualAdjustment")} />
        <Button type="submit" size="sm" disabled={pending} className="self-end">
          {t("adjust")}
        </Button>
      </form>

      <details className="rounded-md border p-2">
        <summary className="cursor-pointer text-sm">{t("editProduct")}</summary>
        <form action={(formData) => run(updateProduct, formData)} className="mt-3 grid gap-2">
          <input type="hidden" name="id" value={product.id} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={t("name")}>
              <Input name="name" defaultValue={product.name} />
            </Field>
            <Field label={t("category")}>
              <Input name="category" defaultValue={product.category} />
            </Field>
            <Field label={t("sku")}>
              <Input name="sku" defaultValue={product.sku} />
            </Field>
            <Field label={t("salePrice")}>
              <Input name="price" type="number" min="0.01" step="0.01" defaultValue={product.price} />
            </Field>
            <Field label={t("cost")}>
              <Input name="cost" type="number" min="0" step="0.01" defaultValue={product.cost} />
            </Field>
            <Field label={t("lowStockThreshold")}>
              <Input name="low_stock_threshold" type="number" min="0" defaultValue={product.low_stock_threshold} />
            </Field>
            <Field label={t("image")}>
              <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1">
                <ImagePlus className="size-4 text-muted-foreground" />
                <Input name="image" type="file" accept="image/*" className="border-0 px-0 focus-visible:ring-0" />
              </div>
            </Field>
          </div>
          <Input name="stock_quantity" type="hidden" value={product.stock_quantity} readOnly />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending}>
              {t("saveProduct")}
            </Button>
            <Button formAction={(formData) => run(toggleProduct, formData)} type="submit" size="sm" variant="outline">
              {t("toggle")}
            </Button>
            <Button formAction={(formData) => run(deleteProduct, formData)} type="submit" size="sm" variant="outline">
              {t("delete")}
            </Button>
          </div>
        </form>
      </details>
    </div>
  );
}

export function ReceivePurchaseOrderForm({ order }: { order: PurchaseOrder }) {
  const t = useTranslations("Dashboard.logistics");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const items = order.items.map((item) => `${item.id}:${item.quantity_ordered}`).join("|");

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await receivePurchaseOrder(formData);

      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        return;
      }

      toast.error(t("receiveFailed"), { description: result.message });
    });
  }

  return (
    <Card>
      <CardContent className="grid gap-3 p-4">
        <div>
          <div className="font-medium text-sm">{t("receivePurchaseOrder")}</div>
          <div className="text-muted-foreground text-xs">{t("receivePurchaseOrderDescription")}</div>
        </div>
        <form action={submit} className="grid gap-3">
          <input type="hidden" name="id" value={order.id} />
          <input type="hidden" name="items" value={items} />
          <div className="grid gap-2">
            {order.items.map((item) => (
              <Field key={item.id} label={item.product?.name ?? t("product")}>
                <Input
                  name={`received_${item.id}`}
                  type="number"
                  min="0"
                  max={item.quantity_ordered}
                  defaultValue={item.quantity_ordered - item.quantity_received}
                />
              </Field>
            ))}
          </div>
          <Field label={t("notes")}>
            <Textarea name="notes" placeholder={t("notesPlaceholder")} />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? t("saving") : t("receiveStock")}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
