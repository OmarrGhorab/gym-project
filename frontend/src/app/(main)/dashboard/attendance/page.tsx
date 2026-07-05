import type { ReactNode } from "react";

import { AlertTriangle, Clock3, Download, LogIn, MapPinned, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { AttendanceActionPanels } from "./_components/attendance-action-panels";
import { AttendanceDayPicker } from "./_components/attendance-day-picker";
import { getAttendancePageData } from "./_components/data";

type PageProps = {
  searchParams: Promise<{ date?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const t = await getTranslations("Dashboard.attendance");
  const locale = await getLocale();
  const numberFormatter = new Intl.NumberFormat(locale);
  const selectedDate = normalizeDate((await searchParams).date);
  const selectedMonth = selectedDate.slice(0, 7);
  const data = await getAttendancePageData({ date: selectedDate, month: selectedMonth });
  const dayTotals = data.records.reduce(
    (acc, row) => ({
      absent: acc.absent + (row.status === "absent" ? 1 : 0),
      late: acc.late + (row.status === "late" ? 1 : 0),
      present: acc.present + (row.status === "present" || row.status === "late" ? 1 : 0),
      records: acc.records + 1,
    }),
    { absent: 0, late: 0, present: 0, records: 0 },
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AttendanceExportButtons
            labels={{
              membersDaily: t("exportMembersDaily"),
              membersMonthly: t("exportMembersMonthly"),
              staffDaily: t("exportStaffDaily"),
              staffMonthly: t("exportStaffMonthly"),
            }}
            selectedDate={selectedDate}
          />
          <AttendanceDayPicker selectedDate={selectedDate} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard icon={Users} label={t("recordsSelectedDay")} value={numberFormatter.format(dayTotals.records)} />
        <MetricCard icon={LogIn} label={t("present")} value={numberFormatter.format(dayTotals.present)} tone="ready" />
        <MetricCard icon={Clock3} label={t("late")} value={numberFormatter.format(dayTotals.late)} tone="warning" />
        <MetricCard
          icon={AlertTriangle}
          label={t("absent")}
          value={numberFormatter.format(dayTotals.absent)}
          tone="critical"
        />
      </div>

      <AttendanceActionPanels
        defaultAttendanceDate={selectedDate}
        employees={data.employees}
        shifts={data.shifts}
        violations={data.violations}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader>
            <CardTitle className="font-normal">{t("dailyStaffAttendance")}</CardTitle>
            <CardDescription>{t("dailyStaffDescription")}</CardDescription>
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
                {data.records.map((record) => {
                  const displayStatus = getAttendanceDisplayStatus(record.status, record.check_out);

                  return (
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
                        <StatusBadge label={t(`statuses.${displayStatus}`)} value={displayStatus} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          <MapPinned />
                          {record.check_in_location?.status ?? t("unknown")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
          <CardTitle className="font-normal">{t("recentMemberVisits")}</CardTitle>
          <CardDescription>{t("recentMemberVisitsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("member")}</TableHead>
                <TableHead>{t("inOut")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("scanMethod")}</TableHead>
                <TableHead>{t("alert")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.memberVisits.map((visit) => (
                <TableRow key={visit.id}>
                  <TableCell>
                    <div className="font-medium">{visit.member?.name ?? t("member")}</div>
                    <div className="text-muted-foreground text-xs">{visit.member?.phone ?? "--"}</div>
                  </TableCell>
                  <TableCell>
                    {formatDateTime(visit.check_in_at, locale)} / {formatDateTime(visit.check_out_at, locale)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge label={t(`visitStatuses.${visit.status}`)} value={visit.status} />
                  </TableCell>
                  <TableCell>{visit.scan_method}</TableCell>
                  <TableCell>{visit.alert_reason ?? "--"}</TableCell>
                </TableRow>
              ))}
              {data.memberVisits.length === 0 ? <EmptyRow cols={5} label={t("noMemberVisits")} /> : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

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
                  <TableCell>{formatDurationMinutes(row.late_minutes, locale)}</TableCell>
                  <TableCell>{formatDurationMinutes(row.early_leave_minutes, locale)}</TableCell>
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

function AttendanceExportButtons({
  labels,
  selectedDate,
}: {
  labels: {
    membersDaily: string;
    membersMonthly: string;
    staffDaily: string;
    staffMonthly: string;
  };
  selectedDate: string;
}) {
  const month = selectedDate.slice(0, 7);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ExportButton href={`/api/attendance/export?resource=attendance&period=daily&date=${selectedDate}`}>
        {labels.staffDaily}
      </ExportButton>
      <ExportButton href={`/api/attendance/export?resource=member-visits&period=daily&date=${selectedDate}`}>
        {labels.membersDaily}
      </ExportButton>
      <ExportButton href={`/api/attendance/export?resource=attendance&period=monthly&month=${month}`}>
        {labels.staffMonthly}
      </ExportButton>
      <ExportButton href={`/api/attendance/export?resource=member-visits&period=monthly&month=${month}`}>
        {labels.membersMonthly}
      </ExportButton>
    </div>
  );
}

function ExportButton({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Button nativeButton={false} size="sm" variant="outline" render={<a href={href} />}>
      <Download className="size-4" />
      {children}
    </Button>
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

function getAttendanceDisplayStatus(status: string, checkOut: string | null) {
  if (checkOut) {
    return "checked_out";
  }

  return status;
}

function statusTone(value: string): "critical" | "neutral" | "ready" | "warning" {
  if (value === "present" || value === "allowed") {
    return "ready";
  }

  if (value === "checked_out") {
    return "neutral";
  }

  if (value === "late" || value === "flagged") {
    return "warning";
  }

  if (value === "absent" || value === "blocked") {
    return "critical";
  }

  return "neutral";
}

function formatDateTime(value: string | null, locale: string) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function formatDurationMinutes(totalMinutes: number, locale: string) {
  const numberFormatter = new Intl.NumberFormat(locale);
  const minutes = Math.max(0, totalMinutes);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours === 0) {
    return `${numberFormatter.format(remainingMinutes)}m`;
  }

  if (remainingMinutes === 0) {
    return `${numberFormatter.format(hours)}h`;
  }

  return `${numberFormatter.format(hours)}h ${numberFormatter.format(remainingMinutes)}m`;
}

function normalizeDate(value: string | undefined) {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00`).getTime())) {
    return value;
  }

  return new Date().toISOString().slice(0, 10);
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
