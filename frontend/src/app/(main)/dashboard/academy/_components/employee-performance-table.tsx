import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import type { StaffAcademyPageData } from "./data";

export function EmployeePerformanceTable({ rows }: { rows: StaffAcademyPageData["employeeRows"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-normal">Employee performance details</CardTitle>
        <CardDescription>Existing backend performance and commission endpoints per employee.</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead>Shift</TableHead>
              <TableHead>Attendance</TableHead>
              <TableHead>Subscriptions</TableHead>
              <TableHead>POS sales</TableHead>
              <TableHead>Commissions</TableHead>
              <TableHead>QR</TableHead>
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
                      <div>{row.employee.shift?.name ?? "No shift"}</div>
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
                      <div className="text-muted-foreground text-xs">{row.commissions.length} recent rows</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.employee.attendance_qr ? "secondary" : "outline"}>
                        {row.employee.attendance_qr ? "Ready" : "Missing"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell className="h-20 text-center text-muted-foreground" colSpan={7}>
                  No active employees returned by the backend.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
