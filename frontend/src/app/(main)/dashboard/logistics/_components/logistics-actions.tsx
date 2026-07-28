"use client";

import * as React from "react";
import { useActionState } from "react";

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
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQueryDialog } from "@/hooks/use-query-dialog";

import {
  adjustProductStock,
  createProduct,
  createPurchaseOrder,
  deleteProduct,
  type LogisticsActionResult,
  receivePurchaseOrder,
  toggleProduct,
  updateProduct,
} from "./actions";
import type { InventoryProduct, PurchaseOrder } from "./shipment-data";

export type ProductActionPermissions = {
  canAdjustInventory: boolean;
  canCreateProduct: boolean;
  canDeleteProduct: boolean;
  canUpdateProduct: boolean;
};

const initialLogisticsActionState: LogisticsActionResult = {
  errors: {},
  message: "",
  ok: true,
  values: {},
};

function Field({
  children,
  error,
  label,
  name,
}: {
  children: React.ReactNode;
  error?: string;
  label: string;
  name?: string;
}) {
  return (
    <div className="grid gap-2">
      {name ? (
        <Label htmlFor={name} className="font-medium text-sm">
          {label}
        </Label>
      ) : (
        <div className="font-medium text-sm">{label}</div>
      )}
      {children}
      <FieldError errors={error ? [{ message: error }] : undefined} />
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

function DatePickerField({ error, name, initialValue = "" }: { error?: string; name: string; initialValue?: string }) {
  const t = useTranslations("Dashboard.logistics");
  const locale = useLocale();
  const [value, setValue] = React.useState(initialValue);
  const selectedDate = parseDateString(value);

  return (
    <Field error={error} label={t("expectedDate")} name={name}>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              id={name}
              type="button"
              variant="outline"
              className="w-full justify-between font-normal"
              aria-invalid={Boolean(error)}
            >
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

export function AddProductDialog({ categories = [] }: { categories?: string[] }) {
  const t = useTranslations("Dashboard.logistics");
  const { onOpenChange: setOpen, open } = useQueryDialog("add-product");
  const submissionCount = React.useRef(0);
  const handledSubmissionCount = React.useRef(0);
  const [categoryOptions, setCategoryOptions] = React.useState(() => [...new Set(categories.filter(Boolean))].sort());
  const [newCategory, setNewCategory] = React.useState("");
  const [isAddingCategory, setIsAddingCategory] = React.useState(false);
  const [selectedCategory, setSelectedCategory] = React.useState("");
  const [state, submitAction, pending] = useActionState(async (_state: LogisticsActionResult, formData: FormData) => {
    submissionCount.current += 1;

    return createProduct(formData);
  }, initialLogisticsActionState);

  React.useEffect(() => {
    const savedCategories = window.localStorage.getItem("gym-product-categories");
    if (!savedCategories) return;
    try {
      const saved = JSON.parse(savedCategories) as unknown;
      if (Array.isArray(saved)) {
        setCategoryOptions((current) =>
          [...new Set([...current, ...saved.filter((item): item is string => typeof item === "string")])].sort(),
        );
      }
    } catch {
      // Ignore invalid local category preferences.
    }
  }, []);

  function addCategory() {
    const category = newCategory.trim();
    if (!category || categoryOptions.some((item) => item.toLowerCase() === category.toLowerCase())) return;
    const next = [...categoryOptions, category].sort();
    setCategoryOptions(next);
    window.localStorage.setItem("gym-product-categories", JSON.stringify(next));
    setSelectedCategory(category);
    setNewCategory("");
    setIsAddingCategory(false);
  }

  React.useEffect(() => {
    if (!state.message || handledSubmissionCount.current === submissionCount.current) return;

    handledSubmissionCount.current = submissionCount.current;

    if (state.ok) {
      toast.success(state.message);
      setOpen(false);
      return;
    }

    toast.error(t("productNotCreated"), { description: state.message });
  }, [setOpen, state, t]);

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
        <form key={`product-${submissionCount.current}-${state.ok}`} action={submitAction} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field error={state.errors?.name?.[0]} label={t("name")} name="product-name">
              <Input
                id="product-name"
                name="name"
                required
                defaultValue={state.values?.name ?? ""}
                placeholder={t("namePlaceholder")}
                aria-invalid={Boolean(state.errors?.name?.[0])}
              />
            </Field>
            <Field error={state.errors?.category?.[0]} label={t("category")} name="product-category">
              <div className="flex gap-2">
                <Select
                  name="category"
                  value={selectedCategory}
                  onValueChange={(value) => setSelectedCategory(value ?? "")}
                >
                  <SelectTrigger
                    id="product-category"
                    className="min-w-0 flex-1"
                    aria-invalid={Boolean(state.errors?.category?.[0])}
                  >
                    <SelectValue placeholder={t("selectCategory")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {categoryOptions.map((category) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={t("addCategory")}
                  onClick={() => setIsAddingCategory((current) => !current)}
                >
                  +
                </Button>
              </div>
              {isAddingCategory ? (
                <div className="flex gap-2">
                  <Input
                    value={newCategory}
                    onChange={(event) => setNewCategory(event.target.value)}
                    placeholder={t("newCategoryPlaceholder")}
                  />
                  <Button type="button" variant="secondary" onClick={addCategory}>
                    {t("saveCategory")}
                  </Button>
                </div>
              ) : null}
            </Field>
            <Field error={state.errors?.sku?.[0]} label={t("sku")} name="product-sku">
              <Input
                id="product-sku"
                name="sku"
                required
                defaultValue={state.values?.sku ?? ""}
                placeholder={t("skuPlaceholder")}
                aria-invalid={Boolean(state.errors?.sku?.[0])}
              />
            </Field>
            <Field label={t("image")} name="product-image">
              <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1">
                <ImagePlus className="size-4 text-muted-foreground" />
                <Input
                  id="product-image"
                  name="image"
                  type="file"
                  accept="image/*"
                  className="border-0 px-0 focus-visible:ring-0"
                />
              </div>
            </Field>
            <Field error={state.errors?.price?.[0]} label={t("salePrice")} name="product-price">
              <Input
                id="product-price"
                name="price"
                required
                type="number"
                defaultValue={state.values?.price ?? ""}
                min="0.01"
                step="0.01"
                placeholder="150"
                aria-invalid={Boolean(state.errors?.price?.[0])}
              />
            </Field>
            <Field error={state.errors?.cost?.[0]} label={t("cost")} name="product-cost">
              <Input
                id="product-cost"
                name="cost"
                required
                type="number"
                defaultValue={state.values?.cost ?? ""}
                min="0"
                step="0.01"
                placeholder="90"
                aria-invalid={Boolean(state.errors?.cost?.[0])}
              />
            </Field>
            <Field error={state.errors?.stock_quantity?.[0]} label={t("openingStock")} name="product-stock-quantity">
              <Input
                id="product-stock-quantity"
                name="stock_quantity"
                type="number"
                min="0"
                defaultValue={state.values?.stock_quantity ?? "0"}
                aria-invalid={Boolean(state.errors?.stock_quantity?.[0])}
              />
            </Field>
            <Field
              error={state.errors?.low_stock_threshold?.[0]}
              label={t("lowStockThreshold")}
              name="product-low-stock-threshold"
            >
              <Input
                id="product-low-stock-threshold"
                name="low_stock_threshold"
                type="number"
                min="0"
                defaultValue={state.values?.low_stock_threshold ?? "5"}
                aria-invalid={Boolean(state.errors?.low_stock_threshold?.[0])}
              />
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
  const [open, setOpen] = React.useState(false);
  const submissionCount = React.useRef(0);
  const handledSubmissionCount = React.useRef(0);
  const [state, submitAction, pending] = useActionState(async (_state: LogisticsActionResult, formData: FormData) => {
    submissionCount.current += 1;

    return createPurchaseOrder(formData);
  }, initialLogisticsActionState);
  const safeProducts = products ?? [];
  const defaultProduct = safeProducts[0];

  React.useEffect(() => {
    if (!state.message || handledSubmissionCount.current === submissionCount.current) return;

    handledSubmissionCount.current = submissionCount.current;

    if (state.ok) {
      toast.success(state.message);
      setOpen(false);
      return;
    }

    toast.error(t("purchaseOrderNotCreated"), { description: state.message });
  }, [state, t]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" disabled={safeProducts.length === 0} />}>
        <Truck />
        {t("createPo")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("createPurchaseOrder")}</DialogTitle>
          <DialogDescription>{t("createPurchaseOrderDescription")}</DialogDescription>
        </DialogHeader>
        <form
          key={`purchase-order-${submissionCount.current}-${state.ok}`}
          action={submitAction}
          className="grid gap-4"
        >
          <Field error={state.errors?.supplier_name?.[0]} label={t("supplier")} name="po-supplier-name">
            <Input
              id="po-supplier-name"
              name="supplier_name"
              required
              defaultValue={state.values?.supplier_name ?? ""}
              placeholder={t("supplierPlaceholder")}
              aria-invalid={Boolean(state.errors?.supplier_name?.[0])}
            />
          </Field>
          <Field error={state.errors?.supplier_phone?.[0]} label={t("supplierPhone")} name="po-supplier-phone">
            <Input
              id="po-supplier-phone"
              name="supplier_phone"
              defaultValue={state.values?.supplier_phone ?? ""}
              placeholder="+20..."
              aria-invalid={Boolean(state.errors?.supplier_phone?.[0])}
            />
          </Field>
          <Field label={t("image")} name="po-image">
            <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1">
              <ImagePlus className="size-4 text-muted-foreground" />
              <Input
                id="po-image"
                name="image"
                type="file"
                accept="image/*"
                className="border-0 px-0 focus-visible:ring-0"
              />
            </div>
          </Field>
          <Field error={state.errors?.product_id?.[0]} label={t("product")} name="po-product-id">
            <Select
              name="product_id"
              defaultValue={state.values?.product_id ?? (defaultProduct ? String(defaultProduct.id) : undefined)}
            >
              <SelectTrigger
                id="po-product-id"
                className="w-full"
                aria-invalid={Boolean(state.errors?.product_id?.[0])}
              >
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
            <Field error={state.errors?.quantity_ordered?.[0]} label={t("quantity")} name="po-quantity-ordered">
              <Input
                id="po-quantity-ordered"
                name="quantity_ordered"
                required
                type="number"
                min="1"
                defaultValue={state.values?.quantity_ordered ?? "1"}
                aria-invalid={Boolean(state.errors?.quantity_ordered?.[0])}
              />
            </Field>
            <Field error={state.errors?.unit_cost?.[0]} label={t("unitCost")} name="po-unit-cost">
              <Input
                id="po-unit-cost"
                name="unit_cost"
                required
                type="number"
                min="0"
                step="0.01"
                defaultValue={state.values?.unit_cost ?? defaultProduct?.cost ?? "0"}
                aria-invalid={Boolean(state.errors?.unit_cost?.[0])}
              />
            </Field>
            <DatePickerField
              error={state.errors?.expected_at?.[0]}
              initialValue={state.values?.expected_at ?? ""}
              name="expected_at"
            />
          </div>
          <Field error={state.errors?.notes?.[0]} label={t("notes")} name="po-notes">
            <Textarea
              id="po-notes"
              name="notes"
              defaultValue={state.values?.notes ?? ""}
              placeholder={t("notesPlaceholder")}
              aria-invalid={Boolean(state.errors?.notes?.[0])}
            />
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

export function ProductQuickActions({
  compact = false,
  permissions,
  product,
}: {
  compact?: boolean;
  permissions: ProductActionPermissions;
  product: InventoryProduct;
}) {
  const t = useTranslations("Dashboard.logistics");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const canShowEditPanel = permissions.canUpdateProduct || permissions.canDeleteProduct;

  if (!permissions.canAdjustInventory && !canShowEditPanel) {
    return null;
  }

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
      {permissions.canAdjustInventory ? (
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
      ) : null}

      {canShowEditPanel ? (
        <details className="rounded-md border p-2">
          <summary className="cursor-pointer text-sm">
            {permissions.canUpdateProduct ? t("editProduct") : t("delete")}
          </summary>
          <form action={(formData) => run(updateProduct, formData)} className="mt-3 grid gap-2">
            <input type="hidden" name="id" value={product.id} />
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label={t("name")}>
                <Input name="name" defaultValue={product.name} disabled={!permissions.canUpdateProduct} />
              </Field>
              <Field label={t("category")}>
                <Input name="category" defaultValue={product.category} disabled={!permissions.canUpdateProduct} />
              </Field>
              <Field label={t("sku")}>
                <Input name="sku" defaultValue={product.sku} disabled={!permissions.canUpdateProduct} />
              </Field>
              <Field label={t("salePrice")}>
                <Input
                  name="price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={product.price}
                  disabled={!permissions.canUpdateProduct}
                />
              </Field>
              <Field label={t("cost")}>
                <Input
                  name="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={product.cost}
                  disabled={!permissions.canUpdateProduct}
                />
              </Field>
              <Field label={t("lowStockThreshold")}>
                <Input
                  name="low_stock_threshold"
                  type="number"
                  min="0"
                  defaultValue={product.low_stock_threshold}
                  disabled={!permissions.canUpdateProduct}
                />
              </Field>
              <Field label={t("image")}>
                <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1">
                  <ImagePlus className="size-4 text-muted-foreground" />
                  <Input
                    name="image"
                    type="file"
                    accept="image/*"
                    className="border-0 px-0 focus-visible:ring-0"
                    disabled={!permissions.canUpdateProduct}
                  />
                </div>
              </Field>
            </div>
            <Input name="stock_quantity" type="hidden" value={product.stock_quantity} readOnly />
            <div className="flex gap-2">
              {permissions.canUpdateProduct ? (
                <>
                  <Button type="submit" size="sm" disabled={pending}>
                    {t("saveProduct")}
                  </Button>
                  <Button
                    formAction={(formData) => run(toggleProduct, formData)}
                    type="submit"
                    size="sm"
                    variant="outline"
                  >
                    {t("toggle")}
                  </Button>
                </>
              ) : null}
              {permissions.canDeleteProduct ? (
                <Button
                  formAction={(formData) => run(deleteProduct, formData)}
                  type="submit"
                  size="sm"
                  variant="outline"
                >
                  {t("delete")}
                </Button>
              ) : null}
            </div>
          </form>
        </details>
      ) : null}
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
