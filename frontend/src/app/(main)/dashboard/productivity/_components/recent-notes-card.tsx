import { Activity, FileText } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { formatDateTime, type OperationsActivity } from "./data";

export function RecentNotesCard({ activity }: { activity: OperationsActivity[] }) {
  return (
    <Card className="shadow-xs">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {activity.length > 0 ? (
          activity.map((item) => (
            <div key={item.id} className="flex items-start gap-4">
              <Activity className="size-5 text-muted-foreground" />
              <div className="min-w-0">
                <div className="truncate font-medium text-sm leading-none">{item.title}</div>
                <div className="text-muted-foreground text-xs">
                  {item.description} · {formatDateTime(item.created_at)}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="flex items-start gap-4 text-muted-foreground">
            <FileText className="size-5" />
            <div className="text-sm">No recent backend activity yet.</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
