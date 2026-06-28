"use client";

import { AlertTriangle } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import type { LiveAttendanceAlert, LiveAttendanceScanMethod } from "./data";
import { formatTime } from "./format";

const chartConfig = {
  count: {
    color: "var(--chart-1)",
    label: "Scans",
  },
} satisfies ChartConfig;

function labelMethod(method: unknown) {
  return String(method ?? "").replaceAll("_", " ");
}

function ScanMethodsChart({ methods }: { methods: LiveAttendanceScanMethod[] }) {
  const data = methods.length > 0 ? methods : [{ method: "No scans", count: 0 }];

  return (
    <ChartContainer config={chartConfig} className="h-64 w-full">
      <BarChart accessibilityLayer data={data} layout="vertical" margin={{ left: 0, right: 40 }}>
        <CartesianGrid horizontal={false} vertical={false} />
        <YAxis dataKey="method" hide tickLine={false} tickMargin={10} type="category" />
        <XAxis dataKey="count" hide type="number" />
        <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
        <Bar barSize={36} dataKey="count" fill="var(--color-count)" fillOpacity={0.55} radius={8}>
          <LabelList
            className="fill-foreground capitalize"
            dataKey="method"
            formatter={(value) => labelMethod(value)}
            fontSize={13}
            offset={12}
            position="insideLeft"
          />
          <LabelList className="fill-foreground" dataKey="count" fontSize={13} position="right" />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export function TopTrafficSources({
  alerts,
  methods,
}: {
  alerts: LiveAttendanceAlert[];
  methods: LiveAttendanceScanMethod[];
}) {
  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <CardTitle className="font-normal">Scan Methods & Alerts</CardTitle>
      </CardHeader>

      <CardContent className="px-0">
        <Tabs defaultValue="methods" className="flex flex-col gap-3">
          <TabsList className="w-full justify-start border-b px-2.5" variant="line">
            <TabsTrigger className="flex-none font-normal" value="methods">
              Methods
            </TabsTrigger>
            <TabsTrigger className="flex-none font-normal" value="alerts">
              Alerts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="methods" className="px-4">
            <ScanMethodsChart methods={methods} />
          </TabsContent>

          <TabsContent value="alerts" className="px-4">
            <div className="flex flex-col gap-2">
              {alerts.length > 0 ? (
                alerts.map((alert) => (
                  <div className="rounded-lg border p-3" key={alert.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-sm">{alert.name}</div>
                        <div className="text-muted-foreground text-xs">{alert.message}</div>
                      </div>
                      <Badge variant={alert.severity === "high" ? "destructive" : "secondary"}>
                        <AlertTriangle />
                        {alert.severity}
                      </Badge>
                    </div>
                    <div className="mt-2 text-muted-foreground text-xs">
                      {alert.type} · {formatTime(alert.time)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
                  No flagged scans, blocked visits, or staff warnings today.
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
