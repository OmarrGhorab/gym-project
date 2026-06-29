import { ArrowRight, ClipboardList, ShieldAlert, Target } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { OperationsSummaryData } from "./data";

export function SummaryCards({ data }: { data: OperationsSummaryData }) {
  const summaryCards = [
    {
      title: "Today",
      value: String(data.summary.today_action_count),
      description: "actions needing attention",
      icon: ClipboardList,
    },
    {
      title: "Review",
      value: String(data.summary.pending_review_count),
      description: "warnings and exceptions",
      icon: ShieldAlert,
    },
    {
      title: "This Week",
      value: `${data.summary.week_progress}%`,
      description: "operations progress",
      icon: Target,
    },
  ] as const;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {summaryCards.map((item) => (
        <Card key={item.title} className="shadow-xs">
          <CardHeader>
            <CardTitle>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <div className="grid size-7 place-items-center rounded-lg border bg-muted">
                  <item.icon className="size-4" />
                </div>
                {item.title}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2">
              <div className="text-2xl leading-none tracking-tight">{item.value}</div>
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground tabular-nums leading-none">{item.description}</p>
                <ArrowRight className="size-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
