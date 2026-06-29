"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { format, parseISO } from "date-fns";
import { CalendarIcon, ImagePlus, PackagePlus, Truck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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

import { createProduct, createPurchaseOrder } from "./actions";
import type { InventoryProduct } from "./shipment-data";

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

export function CreatePurchaseOrderDialog({ products }: { products: InventoryProduct[] }) {
  const t = useTranslations("Dashboard.logistics");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const defaultProduct = products[0];

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
      <DialogTrigger render={<Button size="sm" variant="outline" disabled={products.length === 0} />}>
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
          <Field label={t("product")}>
            <Select name="product_id" defaultValue={defaultProduct ? String(defaultProduct.id) : undefined}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("selectProduct")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {products.map((product) => (
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
            <Button type="submit" disabled={pending || products.length === 0}>
              {pending ? t("saving") : t("createOrder")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
