"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { format, parseISO } from "date-fns";
import { CalendarIcon, ImagePlus, PackagePlus, Truck } from "lucide-react";
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

function formatDateLabel(value: string) {
  if (!value) return "Select date";

  const date = parseISO(value);

  if (Number.isNaN(date.getTime())) return "Select date";

  return format(date, "MMM d, yyyy");
}

function parseDateString(value: string) {
  if (!value) return undefined;

  const date = parseISO(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
}

function DatePickerField({ name }: { name: string }) {
  const [value, setValue] = React.useState("");
  const selectedDate = parseDateString(value);

  return (
    <Field label="Expected date">
      <Popover>
        <PopoverTrigger
          render={
            <Button type="button" variant="outline" className="w-full justify-between font-normal">
              {formatDateLabel(value)}
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

      toast.error("Product not created", { description: result.message });
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <PackagePlus />
        Add Product
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add product</DialogTitle>
          <DialogDescription>Create a POS product with stock and optional image.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input name="name" required placeholder="Protein Shake" />
            </Field>
            <Field label="Category">
              <Input name="category" required placeholder="supplements" />
            </Field>
            <Field label="SKU">
              <Input name="sku" required placeholder="SKU-PROTEIN-01" />
            </Field>
            <Field label="Image">
              <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1">
                <ImagePlus className="size-4 text-muted-foreground" />
                <Input name="image" type="file" accept="image/*" className="border-0 px-0 focus-visible:ring-0" />
              </div>
            </Field>
            <Field label="Sale price">
              <Input name="price" required type="number" min="0.01" step="0.01" placeholder="150" />
            </Field>
            <Field label="Cost">
              <Input name="cost" required type="number" min="0" step="0.01" placeholder="90" />
            </Field>
            <Field label="Opening stock">
              <Input name="stock_quantity" type="number" min="0" defaultValue="0" />
            </Field>
            <Field label="Low stock threshold">
              <Input name="low_stock_threshold" type="number" min="0" defaultValue="5" />
            </Field>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Create product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function CreatePurchaseOrderDialog({ products }: { products: InventoryProduct[] }) {
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

      toast.error("Purchase order not created", { description: result.message });
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" disabled={products.length === 0} />}>
        <Truck />
        Create PO
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create purchase order</DialogTitle>
          <DialogDescription>Restock an existing product from a supplier.</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <Field label="Supplier">
            <Input name="supplier_name" required placeholder="Supplement supplier" />
          </Field>
          <Field label="Supplier phone">
            <Input name="supplier_phone" placeholder="+20..." />
          </Field>
          <Field label="Product">
            <Select name="product_id" defaultValue={defaultProduct ? String(defaultProduct.id) : undefined}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {products.map((product) => (
                    <SelectItem key={product.id} value={String(product.id)}>
                      {product.name} · {product.stock_quantity} left
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Quantity">
              <Input name="quantity_ordered" required type="number" min="1" defaultValue="1" />
            </Field>
            <Field label="Unit cost">
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
          <Field label="Notes">
            <Textarea name="notes" placeholder="Delivery notes" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || products.length === 0}>
              {pending ? "Saving..." : "Create order"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
