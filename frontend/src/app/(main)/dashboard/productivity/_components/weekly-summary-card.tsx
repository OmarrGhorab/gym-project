import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import type { OperationsSummaryData } from "./data";

export function WeeklySummaryCard({ week }: { week: OperationsSummaryData["week"] }) {
  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>{week.label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground">
          {week.member_visits} visits · {week.subscriptions_renewed} subscriptions · {week.sales} sales.
        </p>
        <div className="flex flex-col gap-2">
          <div className="font-medium">
            {week.completed} of {week.total} operational signals completed
          </div>
          <Progress value={week.progress} className="h-2" />
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground text-xs">Payroll paid</div>
            <div className="tabular-nums">{week.payroll_paid}</div>
          </div>
          <div className="rounded-lg border p-2">
            <div className="text-muted-foreground text-xs">Progress</div>
            <div className="tabular-nums">{week.progress}%</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
