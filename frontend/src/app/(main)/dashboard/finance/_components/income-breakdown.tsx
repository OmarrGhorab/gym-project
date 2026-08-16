import { useTranslations } from "next-intl";

import { Money } from "@/components/money/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils";

import type { FinanceMoneySource } from "./data";

export function IncomeBreakdown({ sources }: { sources: FinanceMoneySource[] }) {
  const t = useTranslations("Dashboard.finance");
  const visibleSources = sources.length > 0 ? sources : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">{t("revenueSources")}</CardTitle>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-1 md:grid-cols-3">
        {visibleSources.map((source, index) => (
          <section className="isolate flex gap-[0.5px]" key={source.key}>
            <Separator
              orientation="vertical"
              className="mb-1 h-auto self-auto border-muted-foreground/50 border-l border-dashed bg-transparent"
            />
            <div className="flex min-h-24 flex-1 flex-col justify-between">
              <div className="flex min-w-0 flex-col gap-1 px-1">
                <p className="wrap-break-word text-muted-foreground text-xs leading-none">
                  {source.label} · {Number(source.percentage).toFixed(1)}%
                </p>
                <Money domain="reports" className="block font-heading text-lg leading-none tracking-tight">
                  {formatCurrency(Number(source.amount), { currency: "EGP" })}
                </Money>
              </div>
              <div className="-ml-0.5 h-5 rounded-sm bg-chart-3" style={{ opacity: 1 - index * 0.22 }} />
            </div>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
