"use client";

import { ArrowRight } from "lucide-react";
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

import type { StaffAcademyWarningStatus } from "./data";

function ApprovedLegendIcon() {
  return <span className="block size-2 rounded-[2px] bg-chart-3" />;
}

function PendingLegendIcon() {
  return <span className="block size-2 rounded-[2px] bg-chart-2" />;
}

function AutoAppliedLegendIcon() {
  return <span className="block size-2 rounded-[2px] bg-destructive" />;
}

const chartConfig = {
  approved: {
    label: "Approved",
    color: "var(--chart-3)",
    icon: ApprovedLegendIcon,
  },
  pending: {
    label: "Pending",
    color: "var(--chart-2)",
    icon: PendingLegendIcon,
  },
  auto_applied: {
    label: "Auto Applied",
    color: "var(--destructive)",
    icon: AutoAppliedLegendIcon,
  },
} satisfies ChartConfig;

function WarningDotPattern({ color, id }: { color: string; id: string }) {
  return (
    <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
      <rect width="6" height="6" fill={color} fillOpacity="0.7" />
      <circle cx="1.5" cy="1.5" r="0.8" fill={color} fillOpacity="0.25" />
      <circle cx="4.5" cy="4.5" r="0.8" fill={color} fillOpacity="0.25" />
    </pattern>
  );
}

export function AssignmentStatus({ warnings }: { warnings: StaffAcademyWarningStatus[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">Warning Status</CardTitle>
        <CardAction className="flex items-center gap-1 text-muted-foreground text-xs">
          Review Warnings <ArrowRight className="size-4" />
        </CardAction>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-70 w-full">
          <BarChart accessibilityLayer data={warnings} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
            <defs>
              <WarningDotPattern color="var(--color-approved)" id="warning-approved-pattern" />
              <WarningDotPattern color="var(--color-pending)" id="warning-pending-pattern" />
              <WarningDotPattern color="var(--color-auto_applied)" id="warning-auto-applied-pattern" />
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis axisLine={false} dataKey="label" tickLine={false} tickMargin={10} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent hideIndicator />} />
            <ChartLegend content={<ChartLegendContent className="justify-start" />} verticalAlign="top" />
            <Bar
              dataKey="approved"
              fill="url(#warning-approved-pattern)"
              radius={4}
              stroke="var(--color-approved)"
              strokeOpacity={0.45}
              strokeWidth={0.5}
            />
            <Bar
              dataKey="pending"
              fill="url(#warning-pending-pattern)"
              radius={4}
              stroke="var(--color-pending)"
              strokeOpacity={0.5}
              strokeWidth={0.5}
            />
            <Bar
              dataKey="auto_applied"
              fill="url(#warning-auto-applied-pattern)"
              radius={4}
              stroke="var(--color-auto_applied)"
              strokeOpacity={0.5}
              strokeWidth={0.5}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
