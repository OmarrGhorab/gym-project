import { Download, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

import { RecordExpenseDialog } from "./record-expense-dialog";

export function FinanceToolbarActions({ updatedAt }: { updatedAt: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        <RotateCw className="size-4" />
        <span>Updated {updatedAt}</span>
      </div>
      <Button nativeButton={false} size="sm" variant="outline" render={<a href="/api/finance/export" />}>
        <Download data-icon="inline-start" />
        Export
      </Button>
      <RecordExpenseDialog />
    </div>
  );
}
