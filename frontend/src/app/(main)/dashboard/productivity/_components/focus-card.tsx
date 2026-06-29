import { BellRing } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import type { OperationsSummaryData } from "./data";

export function FocusCard({ summary }: { summary: OperationsSummaryData["summary"] }) {
  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>Focus</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-2xl tracking-tight">{summary.focus_title}</div>
              <div className="line-clamp-2 text-muted-foreground text-sm">{summary.focus_description}</div>
            </div>
            <Button render={<a href="/dashboard/analytics" />} nativeButton={false} className="min-w-24">
              Open
            </Button>
          </div>

          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <BellRing className="size-3" />
            <span>{summary.pending_review_count} items need review</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
