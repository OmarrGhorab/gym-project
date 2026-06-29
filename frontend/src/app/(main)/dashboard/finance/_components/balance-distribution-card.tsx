"use client";

import { useTranslations } from "next-intl";
import { Label, Pie, PieChart } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/utils";

import type { FinanceMoneySource } from "./data";

const methodColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

export function BalanceDistributionCard({ methods }: { methods: FinanceMoneySource[] }) {
  const t = useTranslations("Dashboard.finance");
  const chartConfig = {
    amount: {
      label: t("amount"),
    },
    bank_transfer: {
      color: "var(--chart-1)",
      label: t("bankTransfer"),
    },
    card: {
      color: "var(--chart-2)",
      label: t("card"),
    },
    cash: {
      color: "var(--chart-3)",
      label: t("cash"),
    },
  } satisfies ChartConfig;
  const chartData = methods.map((item, index) => ({
    ...item,
    amountValue: Number(item.amount),
    fill: methodColors[index % methodColors.length],
    label: chartConfig[item.key as keyof typeof chartConfig]?.label ?? item.label,
  }));
  const total = chartData.reduce((sum, item) => sum + item.amountValue, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">{t("paymentMethodAllocation")}</CardTitle>
      </CardHeader>

      <CardContent className="grid items-center gap-4 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)]">
        <ChartContainer config={chartConfig} className="mx-auto aspect-square h-50">
          <PieChart>
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel className="w-52" nameKey="label" />} />
            <Pie
              cornerRadius={6}
              data={chartData}
              dataKey="amountValue"
              innerRadius={65}
              nameKey="label"
              outerRadius={90}
              paddingAngle={2}
              strokeWidth={5}
            >
              <Label
                content={({ viewBox }) => {
                  if (!(viewBox && "cx" in viewBox && "cy" in viewBox)) {
                    return null;
                  }

                  return (
                    <text dominantBaseline="middle" textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                      <tspan className="fill-muted-foreground text-xs" x={viewBox.cx} y={(viewBox.cy ?? 0) - 8}>
                        {t("collected")}
                      </tspan>
                      <tspan
                        className="fill-foreground font-heading font-medium text-lg tabular-nums"
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 14}
                      >
                        {formatCurrency(total, { currency: "EGP", noDecimals: true })}
                      </tspan>
                    </text>
                  );
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        <div className="flex min-w-0 flex-col gap-3">
          {chartData.map((item) => (
            <div className="grid grid-cols-[1fr_auto] items-end gap-3" key={item.key}>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1">
                  <span aria-hidden="true" className="h-2 w-1 rounded-full" style={{ backgroundColor: item.fill }} />
                  <p className="truncate text-muted-foreground text-xs">{item.label}</p>
                </div>
                <p className="font-medium tabular-nums">
                  {formatCurrency(item.amountValue, { currency: "EGP", noDecimals: true })}
                </p>
              </div>
              <div className="font-medium tabular-nums">{Number(item.percentage).toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
