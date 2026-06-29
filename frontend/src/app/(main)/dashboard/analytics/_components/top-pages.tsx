import { useLocale, useTranslations } from "next-intl";

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
  const t = useTranslations("Dashboard.analytics");
  const locale = useLocale();

  return (
    <Card className="h-full gap-2">
      <CardHeader>
        <CardTitle className="font-normal">{t("currentlyInGym")}</CardTitle>
        <CardDescription>{t("currentlyInGymDescription")}</CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        <Table className="[&_td:first-child]:pl-4 [&_td:last-child]:pr-4 [&_th:first-child]:pl-4 [&_th:last-child]:pr-4">
          <TableHeader className="[&_tr]:border-border/50">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-8 font-normal">{t("name")}</TableHead>
              <TableHead className="h-8 w-24 font-normal">{t("type")}</TableHead>
              <TableHead className="h-8 w-24 text-end font-normal">{t("in")}</TableHead>
              <TableHead className="h-8 w-24 text-end font-normal">{t("duration")}</TableHead>
              <TableHead className="h-8 w-28 text-end font-normal">{t("status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-border/50">
            {rows.length > 0 ? (
              rows.map((row) => (
                <TableRow className="hover:bg-muted/40" key={row.id}>
                  <TableCell className="max-w-0 py-4">
                    <div className="truncate font-medium">{row.name}</div>
                    <div className="truncate text-muted-foreground text-xs">
                      {row.scan_method ?? t("manual")} {t("scan")}
                      {row.location_status ? ` · ${row.location_status}` : ""}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground capitalize">{row.role ?? row.type}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatTime(row.check_in_at, locale, t("notScanned"))}
                  </TableCell>
                  <TableCell className="text-end text-muted-foreground tabular-nums">
                    {formatDuration(row.duration_minutes, locale)}
                  </TableCell>
                  <TableCell className="text-end">
                    <Badge className="capitalize" variant={statusVariant(row.status)}>
                      {row.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell className="h-32 text-center text-muted-foreground" colSpan={5}>
                  {t("nobodyInside")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
