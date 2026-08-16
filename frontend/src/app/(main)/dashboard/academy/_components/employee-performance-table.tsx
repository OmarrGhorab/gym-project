"use client";

import { Copy, ScanBarcode } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Money } from "@/components/money/money";
import { Barcode } from "@/components/ui/barcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import type { StaffAcademyPageData } from "./data";

export function EmployeePerformanceTable({ rows }: { rows: StaffAcademyPageData["employeeRows"] }) {
  const t = useTranslations("Dashboard.academy");
  const locale = useLocale();

  return (
    <Card id="employee-performance">
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
                        {row.employee.shift ? row.employee.shift.name : "-"}
                      </div>
                    </TableCell>
                    <TableCell>{row.performance?.attendance_count ?? 0}</TableCell>
                    <TableCell>
                      <div>{row.performance?.coached_services_count ?? row.performance?.subscriptions_sold ?? 0}</div>
                      <Money domain="subscriptions" className="block text-muted-foreground text-xs">
                        {formatCurrency(Number(row.performance?.coached_services_revenue ?? 0), {
                          currency: "EGP",
                          noDecimals: true,
                        })}
                      </Money>
                    </TableCell>
                    <TableCell>
                      <Money domain="sales">
                        {formatCurrency(Number(row.performance?.pos_sales_volume ?? 0), {
                          currency: "EGP",
                          noDecimals: true,
                        })}
                      </Money>
                    </TableCell>
                    <TableCell>
                      <Money domain="commissions" className="block">
                        {formatCurrency(Number(commissionTotal), { currency: "EGP", noDecimals: true })}
                      </Money>
                      <div className="text-muted-foreground text-xs">
                        {t("recentRows", { count: row.commissions.length })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <StaffQrDialog employeeName={row.employee.name} payload={row.employee.attendance_code ?? null} />
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

export function StaffQrDialog({ employeeName, payload }: { employeeName: string; payload: string | null }) {
  const t = useTranslations("Dashboard.academy");

  async function copyPayload() {
    if (!payload) {
      return;
    }

    try {
      await navigator.clipboard.writeText(payload);
      toast.success(t("staffQrCopied"));
    } catch {
      toast.error(t("staffQrCopyFailed"));
    }
  }

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" size="sm" variant={payload ? "secondary" : "outline"} disabled={!payload}>
            <ScanBarcode data-icon="inline-start" />
            {payload ? t("viewQr") : t("missing")}
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("staffQrTitle", { name: employeeName })}</DialogTitle>
          <DialogDescription>{t("staffQrDescription")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {/* Code128, not QR: the desk scanners are 1D lasers, which cannot read a 2D symbol. */}
          <div className="flex items-center justify-center rounded-lg border bg-white p-3">
            {payload ? (
              <Barcode value={payload} height={64} />
            ) : (
              <div className="grid place-items-center gap-2 py-6 text-center text-muted-foreground">
                <ScanBarcode className="size-9" />
                <span className="text-xs">{t("missing")}</span>
              </div>
            )}
          </div>
          <div className="grid gap-3">
            <div className="grid gap-1">
              <p className="text-muted-foreground text-xs">{t("qrPayload")}</p>
              <div className="break-all rounded-lg border bg-muted/30 p-3 font-mono text-sm">
                {payload ?? t("missing")}
              </div>
            </div>
            <Button type="button" variant="outline" onClick={copyPayload} disabled={!payload}>
              <Copy data-icon="inline-start" />
              {t("copyQr")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
