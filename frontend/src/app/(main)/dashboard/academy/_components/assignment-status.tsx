"use client";

import Link from "next/link";

import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import type { StaffAcademyAttendanceException } from "./data";

function ReviewedLegendIcon() {
  return <span className="block size-2 rounded-[2px] bg-chart-3" />;
}

function PendingLegendIcon() {
  return <span className="block size-2 rounded-[2px] bg-chart-2" />;
}

function ExceptionDotPattern({ color, id }: { color: string; id: string }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill={color} fillOpacity="0.7" />
      <circle cx="1.5" cy="1.5" r="0.8" fill={color} fillOpacity="0.25" />
      <circle cx="4.5" cy="4.5" r="0.8" fill={color} fillOpacity="0.25" />
    </pattern>
  );
}

export function AssignmentStatus({ exceptions }: { exceptions: StaffAcademyAttendanceException[] }) {
  const t = useTranslations("Dashboard.academy");
  const chartConfig = {
    reviewed: {
      label: t("reviewed"),
      color: "var(--chart-3)",
      icon: ReviewedLegendIcon,
    },
    pending: {
      label: t("pending"),
      color: "var(--chart-2)",
      icon: PendingLegendIcon,
    },
  } satisfies ChartConfig;

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">{t("attendanceExceptions")}</CardTitle>
        <CardAction>
          <Link
            href="/dashboard/attendance"
            className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground"
          >
            {t("reviewAttendance")} <ArrowRight className="size-4" />
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-70 w-full">
          <BarChart accessibilityLayer data={exceptions} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
            <defs>
              <ExceptionDotPattern color="var(--color-pending)" id="exception-pending-pattern" />
              <ExceptionDotPattern color="var(--color-reviewed)" id="exception-reviewed-pattern" />
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis axisLine={false} dataKey="label" tickLine={false} tickMargin={10} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
            <ChartLegend content={<ChartLegendContent className="justify-start" />} verticalAlign="top" />
            <Bar
              dataKey="pending"
              fill="url(#exception-pending-pattern)"
              radius={4}
              stroke="var(--color-pending)"
              strokeOpacity={0.5}
              strokeWidth={0.5}
            />
            <Bar
              dataKey="reviewed"
              fill="url(#exception-reviewed-pattern)"
              radius={4}
              stroke="var(--color-reviewed)"
              strokeOpacity={0.45}
              strokeWidth={0.5}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
