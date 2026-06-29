"use client";

import { ArrowRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer } from "@/components/ui/chart";

import type { StaffAcademyPerformance } from "./data";

const chartConfig = {
  duration: {
    label: "Score",
    color: "var(--chart-3)",
  },
} satisfies ChartConfig;

type PerformanceHighlight = StaffAcademyPerformance;

function PerformanceHighlightBar({
  height = 0,
  payload,
  width = 0,
  x = 0,
  y = 0,
}: {
  height?: number;
  payload?: PerformanceHighlight;
  width?: number;
  x?: number;
  y?: number;
}) {
  if (!payload) {
    return null;
  }

  const barHeight = Math.min(32, height);
  const barY = y + (height - barHeight) / 2;
  const radius = barHeight / 2;
  const fillWidth = Math.max(width * (payload.score / 100), 86);
  const avatarSize = 22;
  const avatarStart = x + 8;
  const avatarY = barY + (barHeight - avatarSize) / 2 - 1.5;
  const labelX = avatarStart + 34;

  return (
    <g>
      <rect
        fill="color-mix(in oklch, var(--color-duration) 18%, transparent)"
        height={barHeight}
        rx={radius}
        width={width}
        x={x}
        y={barY}
      />
      <rect fill="var(--color-duration)" height={barHeight} rx={radius} width={fillWidth} x={x} y={barY} />

      <foreignObject height={avatarSize + 4} width={avatarSize + 4} x={avatarStart - 2} y={avatarY}>
        <Avatar className="size-5 bg-muted" size="sm">
          <AvatarFallback className="text-foreground">{payload.initials}</AvatarFallback>
        </Avatar>
      </foreignObject>

      <text
        dominantBaseline="middle"
        x={labelX}
        y={barY + barHeight / 2 + 0.5}
        className="fill-primary-foreground font-medium text-xs"
      >
        {payload.role}
      </text>

      <text
        dominantBaseline="middle"
        fill="var(--foreground)"
        fontSize={11}
        textAnchor="end"
        x={x + width - 10}
        y={barY + barHeight / 2 + 0.5}
        className="font-medium tabular-nums"
      >
        {payload.score}%
      </text>
    </g>
  );
}

export function PerformanceHighlights({ highlights }: { highlights: StaffAcademyPerformance[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm">Coach Performance</CardTitle>
        <CardAction className="flex items-center gap-1 text-muted-foreground text-xs">
          Employee Report <ArrowRight className="size-4" />
        </CardAction>
      </CardHeader>
      <CardContent>
        {highlights.length === 0 ? (
          <div className="grid h-70 place-items-center rounded-lg border border-dashed text-muted-foreground text-sm">
            No staff performance data for this month yet.
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-70 w-full">
            <BarChart
              accessibilityLayer
              data={highlights}
              layout="vertical"
              margin={{ bottom: 0, left: 0, right: 8, top: 0 }}
            >
              <CartesianGrid horizontal={false} strokeDasharray="4 4" />
              <XAxis
                axisLine={false}
                domain={[0, 4]}
                tickFormatter={(value) => ["Mon", "Tue", "Wed", "Thu", "Fri"][Number(value)] ?? ""}
                tickLine={false}
                tickMargin={10}
                ticks={[0, 1, 2, 3, 4]}
                type="number"
              />
              <YAxis axisLine={false} dataKey="name" tickLine={false} tickMargin={10} type="category" width={80} />
              <Bar dataKey="start" fill="transparent" stackId="timeline" />
              <Bar dataKey="duration" shape={<PerformanceHighlightBar />} stackId="timeline" />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
