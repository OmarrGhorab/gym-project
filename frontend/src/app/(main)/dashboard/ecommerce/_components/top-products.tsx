import { ArrowUpRight } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

import type { PosDashboardData } from "./data";
import { usePosMoney } from "./format";

const colors = ["var(--chart-3)", "var(--chart-2)", "var(--chart-1)", "var(--chart-4)", "var(--chart-5)"] as const;

export function TopProducts({ data }: { data: PosDashboardData["top_products"] }) {
  const t = useTranslations("Dashboard.ecommerce");
  const posMoney = usePosMoney();

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">{t("topProducts")}</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {t("shareOfSales", { value: data.share_of_sales })}
        </CardDescription>
        <CardAction>
          <ArrowUpRight className="size-4" />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div aria-label={t("salesByCategory")} className="flex h-2 gap-1 overflow-hidden bg-muted" role="img">
            {data.categories.length > 0 ? (
              data.categories.map((category, index) => (
                <div
                  aria-hidden="true"
                  key={category.name}
                  className="rounded-md"
                  style={{
                    backgroundColor: colors[index % colors.length],
                    width: `${category.share}%`,
                  }}
                />
              ))
            ) : (
              <div className="w-full rounded-md bg-muted-foreground/30" />
            )}
          </div>

          <div className="flex flex-wrap gap-4">
            {data.categories.map((category, index) => (
              <div className="flex items-center gap-1" key={category.name}>
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="text-muted-foreground text-xs capitalize">{category.name}</span>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-3">
          <div className="text-muted-foreground text-xs">{t("products")}</div>
          <div className="text-muted-foreground text-xs">{t("units")}</div>
          <div className="text-muted-foreground text-xs">{t("sales")}</div>

          {data.products.length > 0 ? (
            data.products.map((product) => (
              <div className="contents text-sm" key={product.id}>
                <div className="min-w-0">
                  <div className="truncate font-medium">{product.name}</div>
                  <div className="text-muted-foreground text-xs capitalize">{product.category}</div>
                </div>
                <div className="self-center text-muted-foreground tabular-nums">{product.units_sold}</div>
                <div className="self-center font-medium tabular-nums">{posMoney(product.sales)}</div>
              </div>
            ))
          ) : (
            <div className="col-span-3 py-6 text-center text-muted-foreground text-sm">{t("noProductSales")}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
