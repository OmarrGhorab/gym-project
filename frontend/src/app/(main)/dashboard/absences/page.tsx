import { format } from "date-fns";
import { CalendarX2 } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Money } from "@/components/money/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { MoneyDomain } from "@/lib/money-visibility";
import { formatCurrency } from "@/lib/utils";

import { PayrollMonthPicker } from "../payroll/_components/payroll-month-picker";
import { AbsenceDeleteButton, AbsenceEditorDialog } from "./_components/absence-actions";
import { getEmployeeAbsencePageData } from "./_components/data";

type PageProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const t = await getTranslations("Dashboard.absences");
  const locale = await getLocale();
  const params = await searchParams;
  const selectedMonth = normalizeMonth(params.month);
  const data = await getEmployeeAbsencePageData(selectedMonth);
  const totalDeduction = data.absences.reduce((sum, absence) => sum + Number(absence.deduction_amount), 0);
  const employeesWithAbsences = new Set(data.absences.map((absence) => absence.employee.id)).size;
  const { defaultDate, monthEnd, monthStart } = monthDates(selectedMonth);
  const isFutureMonth = selectedMonth > format(new Date(), "yyyy-MM");
  const employeeStatus = new Map(data.employees.map((employee) => [employee.id, employee.payroll_status]));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CalendarX2 className="size-7 text-muted-foreground" />
            <h1 className="text-3xl tracking-tight">{t("title")}</h1>
          </div>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor="month">{t("month")}</Label>
          <PayrollMonthPicker defaultMonth={selectedMonth} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Summary label={t("absenceDays")} value={data.absences.length.toLocaleString(locale)} />
        <Summary label={t("affectedEmployees")} value={employeesWithAbsences.toLocaleString(locale)} />
        <Summary
          domain="payroll"
          label={t("totalDeduction")}
          value={formatCurrency(totalDeduction, { currency: "EGP", noDecimals: true })}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-normal">{t("allEmployees")}</CardTitle>
          <CardDescription>
            {isFutureMonth ? t("futureMonthDescription") : t("allEmployeesDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employee")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("absenceDays")}</TableHead>
                <TableHead>{t("deduction")}</TableHead>
                <TableHead>{t("lastReason")}</TableHead>
                <TableHead className="text-end">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.employees.map((employee) => {
                const employeeAbsences = data.absences.filter((absence) => absence.employee.id === employee.id);
                const deduction = employeeAbsences.reduce((sum, absence) => sum + Number(absence.deduction_amount), 0);
                const locked = employee.payroll_status === "paid";

                return (
                  <TableRow key={employee.id}>
                    <TableCell>
                      <div className="font-medium">{employee.name}</div>
                      <div className="text-muted-foreground text-xs">{employee.role}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={employee.status === "active" ? "secondary" : "outline"}>
                          {t(`statuses.${employee.status}`)}
                        </Badge>
                        {locked ? <Badge variant="outline">{t("payrollLocked")}</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell>{employeeAbsences.length.toLocaleString(locale)}</TableCell>
                    <TableCell>
                      <Money domain="payroll">{formatCurrency(deduction, { currency: "EGP", noDecimals: true })}</Money>
                    </TableCell>
                    <TableCell className="max-w-80 truncate text-muted-foreground">
                      {employeeAbsences[0]?.reason || t("none")}
                    </TableCell>
                    <TableCell className="text-end">
                      <AbsenceEditorDialog
                        defaultDate={defaultDate}
                        employee={employee}
                        locked={locked || isFutureMonth}
                        monthEnd={monthEnd}
                        monthStart={monthStart}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {data.employees.length === 0 ? <EmptyRow cols={6} label={t("noEmployees")} /> : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-normal">{t("records")}</CardTitle>
          <CardDescription>{t("recordsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("employee")}</TableHead>
                <TableHead>{t("reason")}</TableHead>
                <TableHead>{t("deduction")}</TableHead>
                <TableHead>{t("recordedBy")}</TableHead>
                <TableHead className="text-end">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.absences.map((absence) => {
                const employee = data.employees.find((row) => row.id === absence.employee.id) ?? {
                  ...absence.employee,
                  payroll_status: null,
                };
                const locked = employeeStatus.get(absence.employee.id) === "paid";

                return (
                  <TableRow key={absence.id}>
                    <TableCell>{formatDate(absence.date, locale)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{absence.employee.name}</div>
                      <div className="text-muted-foreground text-xs">{absence.employee.role}</div>
                    </TableCell>
                    <TableCell className="max-w-md whitespace-normal">{absence.reason || t("none")}</TableCell>
                    <TableCell>
                      {Number(absence.deduction_amount) > 0 ? (
                        <Money domain="payroll">
                          {formatCurrency(Number(absence.deduction_amount), { currency: "EGP", noDecimals: true })}
                        </Money>
                      ) : (
                        t("noDeduction")
                      )}
                    </TableCell>
                    <TableCell>{absence.recorded_by?.name ?? t("legacyRecord")}</TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <AbsenceEditorDialog
                          absence={absence}
                          defaultDate={defaultDate}
                          employee={employee}
                          locked={locked}
                          monthEnd={monthEnd}
                          monthStart={monthStart}
                        />
                        <AbsenceDeleteButton absence={absence} locked={locked} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {data.absences.length === 0 ? <EmptyRow cols={6} label={t("noRecords")} /> : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ domain, label, value }: { domain?: MoneyDomain; label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-muted-foreground text-sm">{label}</p>
        {domain ? (
          <Money domain={domain} className="block font-medium text-2xl tabular-nums">
            {value}
          </Money>
        ) : (
          <p className="font-medium text-2xl tabular-nums">{value}</p>
        )}
      </CardContent>
    </Card>
  );
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

function normalizeMonth(month: string | undefined) {
  return month && /^\d{4}-\d{2}$/.test(month) ? month : format(new Date(), "yyyy-MM");
}

function monthDates(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const monthStart = `${month}-01`;
  const end = new Date(year, monthNumber, 0);
  const monthEnd = format(end, "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");
  const defaultDate = month === today.slice(0, 7) ? today : monthEnd;
  const lastSelectableDate = month === today.slice(0, 7) ? today : monthEnd;

  return { defaultDate, monthEnd: lastSelectableDate, monthStart };
}

function formatDate(value: string, locale: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(year, month - 1, day),
  );
}
