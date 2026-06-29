import { Info } from "lucide-react";

import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { StaffAcademyKpi } from "./data";

export function KpiCards({ kpis }: { kpis: StaffAcademyKpi[] }) {
  return (
    <section className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <CardHeader>
              <CardTitle className="text-sm">{kpi.label}</CardTitle>
              <CardAction>
                <Info className="size-3 text-muted-foreground" />
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col">
              <div className="text-3xl text-foreground leading-none tracking-tight">{kpi.value}</div>
              <div className="text-right text-muted-foreground text-xs">{kpi.detail}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
