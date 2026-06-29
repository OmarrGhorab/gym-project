"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import type { StaffAcademyPageData } from "./data";

export function EmployeePerformanceTable({ rows }: { rows: StaffAcademyPageData["employeeRows"] }) {
  const t = useTranslations("Dashboard.academy");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">{t("employeePerformance")}</CardTitle>
        <CardDescription>{t("employeePerformanceDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("employee")}</TableHead>
              <TableHead>{t("shift")}</TableHead>
              <TableHead>{t("attendance")}</TableHead>
              <TableHead>{t("subscriptions")}</TableHead>
              <TableHead>{t("posSales")}</TableHead>
              <TableHead>{t("commissions")}</TableHead>
              <TableHead>{t("qr")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map((row) => {
                const commissionTotal =
                  row.performance?.commissions_total ??
                  row.commissions.reduce((sum, commission) => sum + Number(commission.amount), 0).toFixed(2);

                return (
                  <TableRow key={row.employee.id}>
                    <TableCell>
                      <div className="font-medium">{row.employee.name}</div>
                      <div className="text-muted-foreground text-xs">{row.employee.role}</div>
                    </TableCell>
                    <TableCell>
                      <div>{row.employee.shift?.name ?? t("noShift")}</div>
                      <div className="text-muted-foreground text-xs">
                        {row.employee.shift ? `${row.employee.shift.starts_at} - ${row.employee.shift.ends_at}` : "-"}
                      </div>
                    </TableCell>
                    <TableCell>{row.performance?.attendance_count ?? 0}</TableCell>
                    <TableCell>{row.performance?.subscriptions_sold ?? 0}</TableCell>
                    <TableCell>
                      {formatCurrency(Number(row.performance?.pos_sales_volume ?? 0), {
                        currency: "EGP",
                        noDecimals: true,
                      })}
                    </TableCell>
                    <TableCell>
                      <div>{formatCurrency(Number(commissionTotal), { currency: "EGP", noDecimals: true })}</div>
                      <div className="text-muted-foreground text-xs">
                        {t("recentRows", { count: row.commissions.length })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.employee.attendance_qr ? "secondary" : "outline"}>
                        {row.employee.attendance_qr ? t("ready") : t("missing")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell className="h-20 text-center text-muted-foreground" colSpan={7}>
                  {t("noEmployees")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
