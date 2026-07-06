"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { ShoppingCart } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

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
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormSelect } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { createSale, type PosActionResult, searchPosMembers } from "./actions";
import type { PosMemberOption, PosProductOption } from "./data";

export function PosCheckoutClient({ members, products }: { members: PosMemberOption[]; products: PosProductOption[] }) {
  const t = useTranslations("Dashboard.ecommerce");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [memberOptions, setMemberOptions] = React.useState(members);
  const [memberSearchPending, startMemberSearch] = React.useTransition();
  const [salePending, startSaleTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<PosActionResult["errors"]>({});
  const searchRequestId = React.useRef(0);

  const handleMemberSearch = React.useCallback(
    (query: string) => {
      const requestId = searchRequestId.current + 1;
      searchRequestId.current = requestId;

      startMemberSearch(async () => {
        try {
          const results = await searchPosMembers(query);

          if (searchRequestId.current === requestId) {
            setMemberOptions(results);
          }
        } catch {
          if (searchRequestId.current === requestId) {
            setMemberOptions(members);
          }
        }
      });
    },
    [members],
  );

  function submit(formData: FormData) {
    startSaleTransition(async () => {
      const result = await createSale(formData);

      setErrors(result.errors ?? {});

      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        router.refresh();
        return;
      }

      toast.error(t("saleNotCreated"), { description: result.message });
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" disabled={products.length === 0} />}>
        <ShoppingCart />
        {t("checkout")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("checkoutTitle")}</DialogTitle>
          <DialogDescription>{t("checkoutDescription")}</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <FormSelect
            name="product_id"
            required
            className="w-full"
            defaultValue={products[0]?.id ? String(products[0].id) : ""}
            placeholder={t("selectProduct")}
            searchPlaceholder={t("searchProducts")}
            options={products.map((product) => ({
              value: String(product.id),
              label: `${product.name} - ${product.price} EGP - ${t("left", { count: product.stock_quantity })}`,
            }))}
            error={errors?.product_id?.[0]}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field className="gap-1">
              <FieldLabel htmlFor="pos-quantity" className="text-xs">
                {t("quantity")}
              </FieldLabel>
              <Input
                id="pos-quantity"
                name="quantity"
                type="number"
                min="1"
                defaultValue="1"
                placeholder={t("quantity")}
                aria-invalid={Boolean(errors?.quantity?.[0])}
              />
              <FieldError errors={errors?.quantity} />
            </Field>
            <Field className="gap-1">
              <FieldLabel htmlFor="pos-discount" className="text-xs">
                {t("discount")}
              </FieldLabel>
              <Input
                id="pos-discount"
                name="discount"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                placeholder={t("discount")}
                aria-invalid={Boolean(errors?.discount?.[0])}
              />
              <FieldError errors={errors?.discount} />
            </Field>
            <Field className="gap-1">
              <FieldLabel className="text-xs">{t("paymentMethod")}</FieldLabel>
              <FormSelect
                name="payment_method"
                defaultValue="cash"
                options={[
                  { value: "cash", label: t("paymentMethodsShort.cash") },
                  { value: "card", label: t("paymentMethodsShort.card") },
                  { value: "bank_transfer", label: t("paymentMethodsShort.bank_transfer") },
                ]}
                error={errors?.payment_method?.[0]}
              />
            </Field>
          </div>
          <FormSelect
            name="member_id"
            className="w-full"
            placeholder={t("selectMember")}
            searchPlaceholder={memberSearchPending ? t("searchingMembers") : t("searchMembers")}
            options={memberOptions.map((member) => ({
              value: String(member.id),
              label: `${member.name}${member.phone ? ` - ${member.phone}` : ""}`,
            }))}
            onSearchChange={handleMemberSearch}
            error={errors?.member_id?.[0]}
          />
          <Field className="gap-1">
            <FieldLabel htmlFor="pos-notes" className="text-xs">
              {t("notes")}
            </FieldLabel>
            <Textarea id="pos-notes" name="notes" placeholder={t("notes")} aria-invalid={Boolean(errors?.notes?.[0])} />
            <FieldError errors={errors?.notes} />
          </Field>
          <DialogFooter>
            <Button type="submit" disabled={salePending}>
              {salePending ? t("creatingSale") : t("createSale")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
