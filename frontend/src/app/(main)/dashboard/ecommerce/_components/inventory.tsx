"use client";

import { ArrowUpRight, PackageCheck, PackageX, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { Label, Pie, PieChart } from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";

import type { PosDashboardData } from "./data";

const gaugeSegmentCount = 32;

const chartConfig = {
  "in-stock": {
    label: "In stock",
    color: "var(--chart-2)",
  },
  "low-stock": {
    label: "Low stock",
    color: "var(--chart-1)",
  },
  "out-of-stock": {
    label: "Out of stock",
    color: "var(--destructive)",
  },
} satisfies ChartConfig;

function makeGaugeSegments(inStock: number, lowStock: number, out: number) {
  const total = Math.max(inStock + lowStock + out, 1);
  const inStockSegments = Math.round((inStock / total) * gaugeSegmentCount);
  const lowStockSegments = Math.round((lowStock / total) * gaugeSegmentCount);

  return Array.from({ length: gaugeSegmentCount }, (_, index) => {
    let status = "out-of-stock";

    if (index < inStockSegments) {
      status = "in-stock";
    } else if (index < inStockSegments + lowStockSegments) {
      status = "low-stock";
    }

    return {
      fill: `var(--color-${status})`,
      id: `segment-${index + 1}`,
      status,
      value: 1,
    };
  });
}

export function Inventory({ inventory }: { inventory: PosDashboardData["inventory"] }) {
  const t = useTranslations("Dashboard.ecommerce");
  const availablePercent = Number(inventory.availability_rate);
  const gaugeSegments = makeGaugeSegments(
    inventory.in_stock_products,
    inventory.low_stock_products,
    inventory.out_of_stock_products,
  );
  const inventorySummary = [
    {
      icon: PackageCheck,
      label: t("inStock"),
      value: inventory.in_stock_products,
    },
    {
      icon: TriangleAlert,
      label: t("lowStock"),
      value: inventory.low_stock_products,
    },
    {
      icon: PackageX,
      label: t("out"),
      value: inventory.out_of_stock_products,
    },
  ] as const;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-normal text-muted-foreground text-sm">{t("inventory")}</CardTitle>
        <CardDescription className="text-foreground text-xl tabular-nums leading-none tracking-tight">
          {t("availableValue", { value: availablePercent })}
        </CardDescription>
        <CardAction>
          <ArrowUpRight className="size-4" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ChartContainer config={chartConfig} className="mx-auto h-30 w-full">
          <PieChart>
            <Pie
              cx="50%"
              cy="100%"
              cornerRadius={6}
              data={gaugeSegments}
              dataKey="value"
              endAngle={0}
              innerRadius={80}
              outerRadius={110}
              paddingAngle={2}
              startAngle={180}
              stroke="var(--card)"
              strokeWidth={1}
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text textAnchor="middle" x={viewBox.cx} y={viewBox.cy}>
                        <tspan
                          className="fill-foreground font-medium text-2xl tabular-nums"
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 22}
                        >
                          {availablePercent}%
                        </tspan>
                        <tspan className="fill-muted-foreground text-xs" x={viewBox.cx} y={(viewBox.cy || 0) + 38}>
                          {t("available")}
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>
        <Separator />

        <div className="grid grid-cols-3 divide-x">
          {inventorySummary.map((item) => (
            <div key={item.label} className="flex flex-col items-center gap-3 text-center">
              <div className="grid size-9 place-items-center rounded-full bg-muted">
                <item.icon className="size-4 text-muted-foreground" />
              </div>
              <div>
                <div className="text-muted-foreground text-xs leading-none">{item.label}</div>
                <div className="font-medium text-sm tabular-nums">{item.value.toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
