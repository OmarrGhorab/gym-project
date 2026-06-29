import { AlertTriangle, Clock3, LogIn, MapPinned, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { getAttendancePageData } from "./_components/data";

export default async function Page() {
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
        <h1 className="text-3xl tracking-tight">Attendance</h1>
        <p className="text-muted-foreground text-sm">
          Staff scans, monthly attendance, pending warnings, and geofence scan status.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <MetricCard icon={Users} label="Records this month" value={totals.records} />
        <MetricCard icon={LogIn} label="Present" value={totals.present} tone="ready" />
        <MetricCard icon={Clock3} label="Late" value={totals.late} tone="warning" />
        <MetricCard icon={AlertTriangle} label="Absent" value={totals.absent} tone="critical" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader>
            <CardTitle className="font-normal">Recent staff attendance</CardTitle>
            <CardDescription>Latest backend attendance records with QR/GPS status.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>In / Out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>GPS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>
                      <div className="font-medium">{record.employee?.name ?? `#${record.employee_id}`}</div>
                      <div className="text-muted-foreground text-xs">{record.employee?.role ?? "Staff"}</div>
                    </TableCell>
                    <TableCell>{record.date}</TableCell>
                    <TableCell>
                      {record.check_in ?? "--"} / {record.check_out ?? "--"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={record.status} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <MapPinned />
                        {record.check_in_location?.status ?? "unknown"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {data.records.length === 0 ? <EmptyRow cols={5} label="No attendance records yet." /> : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="xl:col-span-5">
          <CardHeader>
            <CardTitle className="font-normal">Pending warnings</CardTitle>
            <CardDescription>Warnings that still need admin review before payroll.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Deduction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.violations.map((violation) => (
                  <TableRow key={violation.id}>
                    <TableCell>
                      <div className="font-medium">{violation.employee?.name ?? "Staff"}</div>
                      <div className="text-muted-foreground text-xs">{violation.violation_date}</div>
                    </TableCell>
                    <TableCell>{violation.type}</TableCell>
                    <TableCell>EGP {violation.deduction_amount}</TableCell>
                  </TableRow>
                ))}
                {data.violations.length === 0 ? <EmptyRow cols={3} label="No pending warnings." /> : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-normal">Monthly staff summary</CardTitle>
          <CardDescription>Grouped by employee for the current month.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Present</TableHead>
                <TableHead>Late</TableHead>
                <TableHead>Absent</TableHead>
                <TableHead>Late minutes</TableHead>
                <TableHead>Early leave</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.summary.map((row) => (
                <TableRow key={row.employee_id}>
                  <TableCell>
                    <div className="font-medium">{row.name}</div>
                    <div className="text-muted-foreground text-xs">{row.role}</div>
                  </TableCell>
                  <TableCell>{row.present_count}</TableCell>
                  <TableCell>{row.late_count}</TableCell>
                  <TableCell>{row.absent_count}</TableCell>
                  <TableCell>{row.late_minutes}m</TableCell>
                  <TableCell>{row.early_leave_minutes}m</TableCell>
                </TableRow>
              ))}
              {data.summary.length === 0 ? <EmptyRow cols={6} label="No monthly summary yet." /> : null}
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
  value: number;
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

function StatusBadge({ value }: { value: string }) {
  const tone = value === "present" ? "ready" : value === "late" ? "warning" : value === "absent" ? "critical" : "neutral";

  return (
    <Badge variant={tone === "critical" ? "destructive" : "outline"} className={toneClass(tone)}>
      {value}
    </Badge>
  );
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
