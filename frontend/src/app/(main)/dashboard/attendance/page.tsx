import { AlertTriangle, Clock3, LogIn, MapPinned, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { getAttendancePageData } from "./_components/data";

export default async function Page() {
  const t = await getTranslations("Dashboard.attendance");
  const locale = await getLocale();
  const numberFormatter = new Intl.NumberFormat(locale);
  const data = await getAttendancePageData();
  const totals = data.summary.reduce(
    (acc, row) => ({
      absent: acc.absent + row.absent_count,
      late: acc.late + row.late_count,
      present: acc.present + row.present_count,
      records: acc.records + row.records_count,
    }),
    { absent: 0, late: 0, present: 0, records: 0 },
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard icon={Users} label={t("recordsThisMonth")} value={numberFormatter.format(totals.records)} />
        <MetricCard icon={LogIn} label={t("present")} value={numberFormatter.format(totals.present)} tone="ready" />
        <MetricCard icon={Clock3} label={t("late")} value={numberFormatter.format(totals.late)} tone="warning" />
        <MetricCard
          icon={AlertTriangle}
          label={t("absent")}
          value={numberFormatter.format(totals.absent)}
          tone="critical"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader>
            <CardTitle className="font-normal">{t("recentStaffAttendance")}</CardTitle>
            <CardDescription>{t("recentStaffDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("employee")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("inOut")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("gps")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="font-medium">{record.employee?.name ?? `#${record.employee_id}`}</div>
                      <div className="text-muted-foreground text-xs">{record.employee?.role ?? t("staff")}</div>
                    </TableCell>
                    <TableCell>{record.date}</TableCell>
                    <TableCell>
                      {record.check_in ?? "--"} / {record.check_out ?? "--"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge label={t(`statuses.${record.status}`)} value={record.status} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <MapPinned />
                        {record.check_in_location?.status ?? t("unknown")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {data.records.length === 0 ? <EmptyRow cols={5} label={t("noRecords")} /> : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle className="font-normal">{t("pendingWarnings")}</CardTitle>
            <CardDescription>{t("pendingWarningsDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("employee")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("deduction")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.violations.map((violation) => (
                  <TableRow key={violation.id}>
                    <TableCell>
                      <div className="font-medium">{violation.employee?.name ?? t("staff")}</div>
                      <div className="text-muted-foreground text-xs">{violation.violation_date}</div>
                    </TableCell>
                    <TableCell>{violation.type}</TableCell>
                    <TableCell>EGP {violation.deduction_amount}</TableCell>
                  </TableRow>
                ))}
                {data.violations.length === 0 ? <EmptyRow cols={3} label={t("noWarnings")} /> : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-normal">{t("monthlyStaffSummary")}</CardTitle>
          <CardDescription>{t("monthlyStaffDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employee")}</TableHead>
                <TableHead>{t("present")}</TableHead>
                <TableHead>{t("late")}</TableHead>
                <TableHead>{t("absent")}</TableHead>
                <TableHead>{t("lateMinutes")}</TableHead>
                <TableHead>{t("earlyLeave")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.summary.map((row) => (
                <TableRow key={row.employee_id}>
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-muted-foreground text-xs">{row.role}</div>
                  </TableCell>
                  <TableCell>{numberFormatter.format(row.present_count)}</TableCell>
                  <TableCell>{numberFormatter.format(row.late_count)}</TableCell>
                  <TableCell>{numberFormatter.format(row.absent_count)}</TableCell>
                  <TableCell>{t("minutesShort", { count: numberFormatter.format(row.late_minutes) })}</TableCell>
                  <TableCell>{t("minutesShort", { count: numberFormatter.format(row.early_leave_minutes) })}</TableCell>
                </TableRow>
              ))}
              {data.summary.length === 0 ? <EmptyRow cols={6} label={t("noMonthlySummary")} /> : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  tone = "neutral",
  value,
}: {
  icon: typeof Users;
  label: string;
  tone?: "neutral" | "ready" | "warning" | "critical";
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="font-medium text-2xl tabular-nums">{value}</p>
        </div>
        <Icon className={toneClass(tone)} />
      </CardContent>
    </Card>
  );
}

function StatusBadge({ label, value }: { label: string; value: string }) {
  const tone = statusTone(value);

  return (
    <Badge variant={tone === "critical" ? "destructive" : "outline"} className={toneClass(tone)}>
      {label}
    </Badge>
  );
}

function statusTone(value: string): "critical" | "neutral" | "ready" | "warning" {
  if (value === "present") {
    return "ready";
  }

  if (value === "late") {
    return "warning";
  }

  if (value === "absent") {
    return "critical";
  }

  return "neutral";
}

function toneClass(tone: "neutral" | "ready" | "warning" | "critical") {
  if (tone === "ready") {
    return "text-emerald-600 dark:text-emerald-400";
  }
  if (tone === "warning") {
    return "text-amber-600 dark:text-amber-400";
  }
  if (tone === "critical") {
    return "text-destructive";
  }

  return "text-muted-foreground";
}

function EmptyRow({ cols, label }: { cols: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={cols} className="py-8 text-center text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}
