import { CalendarDays, Download } from "lucide-react";

import { Money } from "@/components/money/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { getDailyReport } from "./_components/data";
import { DailyReportDatePicker } from "./_components/date-picker";

export default async function Page({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date } = await searchParams;
  const report = await getDailyReport(date);
  const attendance = report.attendance.totals;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">Daily report</h1>
          <p className="text-muted-foreground text-sm">
            Everything that happened on one working day, and who did it. The day runs to 5am, so a shift that finished
            at 3am belongs here rather than to the next morning.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DailyReportDatePicker date={report.business_date} />
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <a href={`/api/reports/daily?date=${report.business_date}`} target="_blank" rel="noopener noreferrer">
              <Download className="size-3.5" /> PDF
            </a>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
        <Badge variant="outline" className="gap-1.5">
          <CalendarDays className="size-3" /> {report.business_date}
        </Badge>
        {report.generated_at ? (
          <span>Sent automatically at {new Date(report.generated_at).toLocaleString()}</span>
        ) : (
          <span>Not sent yet — this is being read live from the ledger.</span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Collected" value={report.money.collections} count={`${report.money.payment_count} payment(s)`} />
        <Stat label="Expenses" value={report.money.expenses} count={`${report.money.expense_count} entry(ies)`} />
        <Stat label="Net" value={report.money.net} count="Collected minus expenses" />
        <Stat label="Refunds" value={report.money.refunds} count="Already netted off above" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-normal">Who handled the money</CardTitle>
          <CardDescription>Every amount of the day against the person who took it in or spent it.</CardDescription>
        </CardHeader>
        <CardContent>
          {report.by_staff.length === 0 ? (
            <Empty>No money was taken or spent on this day.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-end">Collected</TableHead>
                  <TableHead className="text-end">Payments</TableHead>
                  <TableHead className="text-end">Spent</TableHead>
                  <TableHead className="text-end">Expenses</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.by_staff.map((row) => (
                  <TableRow key={row.user_id ?? row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      <Money domain="reports">{row.collected}</Money>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{row.payment_count}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      <Money domain="reports">{row.spent}</Money>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">{row.expense_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-normal">By method</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            <Stat compact label="Cash" value={report.money.by_method.cash} />
            <Stat compact label="Card" value={report.money.by_method.card} />
            <Stat compact label="Bank" value={report.money.by_method.bank} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="font-normal">By source</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-4">
            <Stat compact label="Memberships" value={report.money.by_source.subscriptions} />
            <Stat compact label="Extra plans" value={report.money.by_source.addons} />
            <Stat compact label="Shop" value={report.money.by_source.pos} />
            <Stat compact label="Other" value={report.money.by_source.other} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-normal">Shifts</CardTitle>
          <CardDescription>Who held the desk, and how their drawer came out.</CardDescription>
        </CardHeader>
        <CardContent>
          {report.shifts.length === 0 ? (
            <Empty>No shift was opened on this day.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shift</TableHead>
                  <TableHead>Staff on duty</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Closed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-end">Opening float</TableHead>
                  <TableHead className="text-end">Expected</TableHead>
                  <TableHead className="text-end">Counted</TableHead>
                  <TableHead className="text-end">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.shifts.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell>{shift.shift ?? "—"}</TableCell>
                    <TableCell className="font-medium">{shift.staff}</TableCell>
                    <TableCell className="tabular-nums">{shift.opened_at ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{shift.closed_at ?? "—"}</TableCell>
                    <TableCell className="capitalize">{shift.status.replaceAll("_", " ")}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      <Money domain="reports">{shift.opening_float}</Money>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      <Money domain="reports">{shift.expected_cash ?? "—"}</Money>
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      <Money domain="reports">{shift.counted_cash ?? "—"}</Money>
                    </TableCell>
                    <TableCell className={cnVariance(shift.variance)}>
                      <Money domain="reports">{shift.variance ?? "—"}</Money>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-normal">Staff attendance</CardTitle>
          <CardDescription>
            {attendance.present} present · {attendance.absent} absent · {attendance.late} late · {attendance.no_scan}{" "}
            never scanned · {attendance.still_in} not signed out
          </CardDescription>
        </CardHeader>
        <CardContent>
          {report.attendance.rows.length === 0 ? (
            <Empty>No active staff on record.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Shift</TableHead>
                  <TableHead>In</TableHead>
                  <TableHead>Out</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.attendance.rows.map((row) => (
                  <TableRow key={row.employee_id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.role ?? "—"}</TableCell>
                    <TableCell>{row.shift ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{row.check_in ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{row.check_out ?? "—"}</TableCell>
                    <TableCell>
                      <AttendanceBadge status={row.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-normal">Memberships sold ({report.memberships.count})</CardTitle>
        </CardHeader>
        <CardContent>
          {report.memberships.count === 0 ? (
            <Empty>No membership was sold on this day.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead className="text-end">Price</TableHead>
                  <TableHead>Sold by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.memberships.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="tabular-nums">{row.time ?? "—"}</TableCell>
                    <TableCell className="font-medium">{row.member ?? "—"}</TableCell>
                    <TableCell>{row.plan ?? "—"}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      <Money domain="reports">{row.price}</Money>
                    </TableCell>
                    <TableCell>{row.sold_by}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-normal">Expenses ({report.money.expense_count})</CardTitle>
          </CardHeader>
          <CardContent>
            {report.expenses.length === 0 ? (
              <Empty>Nothing was spent on this day.</Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-end">Amount</TableHead>
                    <TableHead>Recorded by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.expenses.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="tabular-nums">{row.time ?? "—"}</TableCell>
                      <TableCell>{row.category ?? "—"}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        <Money domain="reports">{row.amount}</Money>
                      </TableCell>
                      <TableCell>{row.recorded_by}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-normal">Payments ({report.money.payment_count})</CardTitle>
          </CardHeader>
          <CardContent>
            {report.payments.length === 0 ? (
              <Empty>No payment was taken on this day.</Empty>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-end">Amount</TableHead>
                    <TableHead>Recorded by</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.payments.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="tabular-nums">{row.time ?? "—"}</TableCell>
                      <TableCell className="capitalize">{row.source}</TableCell>
                      <TableCell className="capitalize">{row.method}</TableCell>
                      <TableCell className="text-end tabular-nums">
                        <Money domain="reports">{row.amount}</Money>
                      </TableCell>
                      <TableCell>{row.recorded_by}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({
  compact = false,
  count,
  label,
  value,
}: {
  compact?: boolean;
  count?: string;
  label: string;
  value: string;
}) {
  return (
    <div className={compact ? "rounded-md bg-muted/40 px-3 py-2" : "rounded-lg border bg-card/50 px-4 py-3"}>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className={compact ? "font-medium tabular-nums" : "font-semibold text-xl tabular-nums"}>
        <Money domain="reports">{value}</Money>
      </div>
      {count ? <div className="mt-0.5 text-muted-foreground text-xs">{count}</div> : null}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-muted-foreground text-sm">{children}</p>;
}

/** A drawer that did not match is the one line on this page that needs answering. */
function cnVariance(variance: string | null) {
  const base = "text-end tabular-nums";

  if (variance === null || Number(variance) === 0) {
    return base;
  }

  return `${base} font-medium text-destructive`;
}

const ATTENDANCE_TONES: Record<string, string> = {
  present: "text-emerald-600 dark:text-emerald-400",
  absent: "text-destructive",
};

function AttendanceBadge({ status }: { status: string }) {
  // Anything else — late, never scanned — is a question rather than a verdict.
  const tone = ATTENDANCE_TONES[status] ?? "text-amber-600 dark:text-amber-400";

  return (
    <Badge variant="outline" className={`${tone} capitalize`}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}
