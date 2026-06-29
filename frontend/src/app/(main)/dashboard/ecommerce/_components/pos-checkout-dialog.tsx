import { ShoppingCart } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
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
import { NativeSelect } from "@/components/ui/native-select";
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
          <NativeSelect
            name="product_id"
            required
            className="w-full"
            defaultValue={products[0]?.id ? String(products[0].id) : ""}
          >
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} - {product.price} EGP - {t("left", { count: product.stock_quantity })}
              </option>
            ))}
          </NativeSelect>
          <div className="grid gap-3 sm:grid-cols-3">
            <Input name="quantity" type="number" min="1" defaultValue="1" />
            <Input name="discount" type="number" min="0" step="0.01" defaultValue="0" />
            <NativeSelect name="payment_method" defaultValue="cash" className="w-full">
              <option value="cash">{t("paymentMethodsShort.cash")}</option>
              <option value="card">{t("paymentMethodsShort.card")}</option>
              <option value="bank_transfer">{t("paymentMethodsShort.bank_transfer")}</option>
            </NativeSelect>
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
