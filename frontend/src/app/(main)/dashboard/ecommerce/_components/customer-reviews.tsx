import { ArrowUpRight, PackageX, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { PosStockAlert } from "./data";

export function CustomerReviews({ alerts }: { alerts: PosStockAlert[] }) {
  const t = useTranslations("Dashboard.ecommerce");
  const outCount = alerts.filter((alert) => alert.status === "out").length;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">{t("stockAlerts")}</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {t("productsNeedAction", { count: alerts.length })}
        </CardDescription>
        <CardAction>
          <ArrowUpRight className="size-4" />
        </CardAction>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="rounded-lg bg-muted p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-background">
              {outCount > 0 ? (
                <PackageX className="size-4 text-destructive" />
              ) : (
                <TriangleAlert className="size-4 text-muted-foreground" />
              )}
            </div>
            <div>
              <div className="font-medium text-sm">{outCount > 0 ? t("outProductsFound") : t("lowStockWatchlist")}</div>
              <p className="mt-2 line-clamp-3 min-h-[4.5em] text-muted-foreground text-sm">{t("restockDescription")}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {alerts.length > 0 ? (
            alerts.slice(0, 4).map((alert) => (
              <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2" key={alert.id}>
                <div className="min-w-0">
                  <div className="truncate font-medium text-sm">{alert.name}</div>
                  <div className="text-muted-foreground text-xs capitalize">
                    {alert.category} · {t("threshold", { value: alert.low_stock_threshold })}
                  </div>
                </div>
                <Badge variant={alert.status === "out" ? "destructive" : "outline"}>
                  {t("left", { count: alert.stock_quantity })}
                </Badge>
              </div>
            ))
          ) : (
            <div className="rounded-lg border px-4 py-6 text-center text-muted-foreground text-sm">
              {t("noStockAlerts")}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
