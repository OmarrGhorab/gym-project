"use client";

import Link from "next/link";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

import type { StaffAcademyPerformance } from "./data";

export function PerformanceHighlights({ highlights }: { highlights: StaffAcademyPerformance[] }) {
  const t = useTranslations("Dashboard.academy");
  const chartHeight = Math.min(720, Math.max(320, highlights.length * 38));
  const chartConfig = {
    score: {
      label: t("score"),
      color: "var(--chart-3)",
    },
  } satisfies ChartConfig;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">{t("coachPerformance")}</CardTitle>
        <CardAction>
          <Link
            href="/dashboard/academy#employee-performance"
            className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
          >
            {t("employeeReport")} <ArrowRight className="size-4" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {highlights.length === 0 ? (
          <div className="grid h-70 place-items-center rounded-lg border border-dashed text-muted-foreground text-sm">
            {t("noPerformance")}
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="w-full" style={{ height: chartHeight }}>
            <BarChart
              accessibilityLayer
              data={highlights}
              layout="vertical"
              margin={{ bottom: 0, left: 0, right: 40, top: 0 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="4 4" />
              <XAxis
                axisLine={false}
                domain={[0, 100]}
                tickLine={false}
                tickMargin={10}
                tickFormatter={(value) => `${value}%`}
                ticks={[0, 25, 50, 75, 100]}
                type="number"
              />
              <YAxis axisLine={false} dataKey="name" tickLine={false} tickMargin={10} type="category" width={140} />
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Bar dataKey="score" fill="var(--color-score)" radius={6}>
                <LabelList
                  dataKey="score"
                  formatter={(value) => `${Number(value ?? 0)}%`}
                  position="right"
                  className="fill-foreground font-medium text-xs"
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
