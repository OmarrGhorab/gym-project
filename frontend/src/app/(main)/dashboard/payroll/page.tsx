import { format } from "date-fns";
import { Banknote, ReceiptText } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import { generatePayroll, markPayrollPaid, updatePayroll } from "./_components/actions";
import { getPayrollPageData } from "./_components/data";
import { PayrollMonthPicker } from "./_components/payroll-month-picker";

export default async function Page() {
  const t = await getTranslations("Dashboard.payroll");
  const rows = await getPayrollPageData();
  const pending = rows.filter((row) => row.status === "pending");
  const totalPending = pending.reduce((sum, row) => sum + Number(row.net_salary), 0);
  const attendanceDeductions = rows.reduce((sum, row) => sum + Number(row.attendance_deductions), 0);
  const defaultMonth = format(new Date(), "yyyy-MM");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <form action={generatePayroll} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="month">{t("month")}</Label>
            <PayrollMonthPicker defaultMonth={defaultMonth} />
          </div>
          <Button type="submit">
            <Banknote />
            {t("generate")}
          </Button>
        </form>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employee")}</TableHead>
                <TableHead>{t("month")}</TableHead>
                <TableHead>{t("base")}</TableHead>
                <TableHead>{t("attendance")}</TableHead>
                <TableHead>{t("adjustments")}</TableHead>
                <TableHead>{t("net")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead className="text-end">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">
                      {row.employee.name ?? t("employeeFallback", { id: row.employee.id })}
                    </div>
                    <div className="text-muted-foreground text-xs">{row.employee.role ?? t("staff")}</div>
                  </TableCell>
                  <TableCell>{row.month}</TableCell>
                  <TableCell>
                    {formatCurrency(Number(row.base_salary), { currency: "EGP", noDecimals: true })}
                  </TableCell>
                  <TableCell>
                    {formatCurrency(Number(row.attendance_deductions), { currency: "EGP", noDecimals: true })}
                  </TableCell>
                  <TableCell>
                    <form action={updatePayroll} className="grid min-w-[240px] grid-cols-[1fr_1fr_auto] gap-2">
                      <input type="hidden" name="id" value={row.id} />
                      <Input name="bonuses" type="number" min="0" step="0.01" defaultValue={row.bonuses} aria-label={t("bonuses")} />
                      <Input name="deductions" type="number" min="0" step="0.01" defaultValue={row.deductions} aria-label={t("deductions")} />
                      <Button type="submit" size="sm" variant="outline">
                        {t("save")}
                      </Button>
                    </form>
                  </TableCell>
                  <TableCell className="font-medium">
                    {formatCurrency(Number(row.net_salary), { currency: "EGP", noDecimals: true })}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.status === "paid" ? "secondary" : "outline"}>{row.status}</Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-2">
                      <Button
                        render={<a href={`/api/payroll/${row.id}/payslip`} />}
                        nativeButton={false}
                        size="sm"
                        variant="outline"
                      >
                        <ReceiptText />
                        {t("payslip")}
                      </Button>
                      {row.status !== "paid" ? (
                        <form action={markPayrollPaid}>
                          <input type="hidden" name="id" value={row.id} />
                          <Button type="submit" size="sm">
                            {t("pay")}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
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
