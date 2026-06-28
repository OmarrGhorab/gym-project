import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import type { LiveAttendanceInsideRow } from "./data";
import { formatDuration, formatTime } from "./format";

function statusVariant(status: string) {
  if (["blocked", "late", "flagged"].includes(status)) {
    return "destructive" as const;
  }

  return "secondary" as const;
}

export function TopPages({ rows }: { rows: LiveAttendanceInsideRow[] }) {
  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <CardTitle className="font-normal">Currently In The Gym</CardTitle>
        <CardDescription>Members and employees who checked in and have not checked out.</CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
          <TableHeader className="[&_tr]:border-border/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 font-normal">Name</TableHead>
              <TableHead className="h-8 w-24 font-normal">Type</TableHead>
              <TableHead className="h-8 w-24 text-right font-normal">In</TableHead>
              <TableHead className="h-8 w-24 text-right font-normal">Duration</TableHead>
              <TableHead className="h-8 w-28 text-right font-normal">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-border/50">
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow className="hover:bg-muted/40" key={row.id}>
                  <TableCell className="max-w-0 py-4">
                    <div className="truncate font-medium">{row.name}</div>
                    <div className="truncate text-muted-foreground text-xs">
                      {row.scan_method ?? "manual"} scan
                      {row.location_status ? ` · ${row.location_status}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground capitalize">{row.role ?? row.type}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatTime(row.check_in_at)}</TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {formatDuration(row.duration_minutes)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge className="capitalize" variant={statusVariant(row.status)}>
                      {row.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell className="h-32 text-center text-muted-foreground" colSpan={5}>
                  Nobody is currently checked in.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
