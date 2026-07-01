import { ShoppingCart } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { FormSelect } from "@/components/ui/form-controls";
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
import { Textarea } from "@/components/ui/textarea";

import { createSale } from "./actions";
import type { PosProductOption } from "./data";

export async function PosCheckoutDialog({ products }: { products: PosProductOption[] }) {
  const t = await getTranslations("Dashboard.ecommerce");

  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" disabled={products.length === 0} />}>
        <ShoppingCart />
        {t("checkout")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("checkoutTitle")}</DialogTitle>
          <DialogDescription>{t("checkoutDescription")}</DialogDescription>
        </DialogHeader>
        <form action={createSale} className="grid gap-4">
          <FormSelect
            name="product_id"
            required
            className="w-full"
            defaultValue={products[0]?.id ? String(products[0].id) : ""}
            options={products.map((product) => ({
              value: String(product.id),
              label: `${product.name} - ${product.price} EGP - ${t("left", { count: product.stock_quantity })}`,
            }))}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input name="quantity" type="number" min="1" defaultValue="1" />
            <Input name="discount" type="number" min="0" step="0.01" defaultValue="0" />
            <FormSelect
              name="payment_method"
              defaultValue="cash"
              options={[
                { value: "cash", label: t("paymentMethodsShort.cash") },
                { value: "card", label: t("paymentMethodsShort.card") },
                { value: "bank_transfer", label: t("paymentMethodsShort.bank_transfer") },
              ]}
            />
          </div>
          <Input name="member_id" type="number" min="1" placeholder={t("memberId")} />
          <Textarea name="notes" placeholder={t("notes")} />
          <DialogFooter>
            <Button type="submit">{t("createSale")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
