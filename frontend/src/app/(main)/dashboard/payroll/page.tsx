import { format } from "date-fns";
import { Banknote, ReceiptText } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import { getPayrollPageData } from "./_components/data";
import { PayrollAdjustmentForm, PayrollGenerateForm, PayrollPayForm } from "./_components/payroll-action-forms";
import { PayrollMonthPicker } from "./_components/payroll-month-picker";

type PageProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const t = await getTranslations("Dashboard.payroll");
  const params = await searchParams;
  const defaultMonth = normalizePayrollMonth(params.month);
  const rows = await getPayrollPageData(defaultMonth);
  const pending = rows.filter((row) => row.status === "pending");
  const totalPending = pending.reduce((sum, row) => sum + Number(row.net_salary), 0);
  const attendanceDeductions = rows.reduce((sum, row) => sum + Number(row.attendance_deductions), 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <PayrollGenerateForm>
          <div className="space-y-1">
            <Label htmlFor="month">{t("payrollMonth")}</Label>
            <PayrollMonthPicker defaultMonth={defaultMonth} />
          </div>
          <Button type="submit">
            <Banknote />
            {t("generate")}
          </Button>
        </PayrollGenerateForm>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Summary label={t("entries")} value={rows.length.toString()} />
        <Summary
          label={t("pendingPayroll")}
          value={formatCurrency(totalPending, { currency: "EGP", noDecimals: true })}
        />
        <Summary
          label={t("attendanceDeductions")}
          value={formatCurrency(attendanceDeductions, { currency: "EGP", noDecimals: true })}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-normal">{t("salaryReceipts")}</CardTitle>
          <CardDescription>{t("salaryReceiptsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table className="min-w-[1180px] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[16rem]">{t("employee")}</TableHead>
                <TableHead className="w-[8rem]">{t("paycheckMonth")}</TableHead>
                <TableHead className="w-[7rem]">{t("payDay")}</TableHead>
                <TableHead className="w-[7rem] text-end">{t("base")}</TableHead>
                <TableHead className="w-[7rem] text-end">{t("commissions")}</TableHead>
                <TableHead className="w-[7rem] text-end">{t("attendance")}</TableHead>
                <TableHead className="w-[22rem]">{t("adjustments")}</TableHead>
                <TableHead className="w-[8rem] text-end">{t("net")}</TableHead>
                <TableHead className="w-[7rem]">{t("status")}</TableHead>
                <TableHead className="w-[10rem] text-end">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="align-middle">
                    <div className="font-medium">
                      {row.employee.name ?? t("employeeFallback", { id: row.employee.id })}
                    </div>
                    <div className="text-muted-foreground text-xs">{row.employee.role ?? t("staff")}</div>
                  </TableCell>
                  <TableCell className="align-middle">
                    <div className="font-medium">{formatPayrollMonth(row.month)}</div>
                    <div className="text-muted-foreground text-xs">{row.month}</div>
                  </TableCell>
                  <TableCell className="align-middle">
                    <Badge variant="outline">{row.employee.pay_day ?? t("payDayUnset")}</Badge>
                  </TableCell>
                  <TableCell className="text-end align-middle">
                    {formatCurrency(Number(row.base_salary), { currency: "EGP", noDecimals: true })}
                  </TableCell>
                  <TableCell className="text-end align-middle">
                    {formatCurrency(Number(row.commissions_total), { currency: "EGP", noDecimals: true })}
                  </TableCell>
                  <TableCell className="text-end align-middle">
                    {formatCurrency(Number(row.attendance_deductions), { currency: "EGP", noDecimals: true })}
                  </TableCell>
                  <TableCell className="align-middle">
                    <PayrollAdjustmentForm
                      attendanceDeductions={row.attendance_deductions}
                      bonuses={row.bonuses}
                      deductions={row.deductions}
                      id={row.id}
                    />
                  </TableCell>
                  <TableCell className="text-end align-middle font-medium">
                    {formatCurrency(Number(row.net_salary), { currency: "EGP", noDecimals: true })}
                  </TableCell>
                  <TableCell className="align-middle">
                    <Badge variant={row.status === "paid" ? "secondary" : "outline"}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-end align-middle">
                    <div className="flex justify-end gap-2 whitespace-nowrap">
                      <Button
                        render={<a href={`/api/payroll/${row.id}/payslip`} />}
                        nativeButton={false}
                        size="sm"
                        variant="outline"
                      >
                        <ReceiptText />
                        {t("payslip")}
                      </Button>
                      {row.status !== "paid" ? <PayrollPayForm id={row.id} /> : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                    {t("noRecords")}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="font-medium text-2xl tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}

function formatPayrollMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const date = new Date(year, (monthIndex || 1) - 1, 1);

  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(date);
}

function normalizePayrollMonth(month: string | undefined) {
  return month && /^\d{4}-\d{2}$/.test(month) ? month : format(new Date(), "yyyy-MM");
}
