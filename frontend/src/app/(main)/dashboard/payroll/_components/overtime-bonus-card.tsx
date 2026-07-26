"use client";

import * as React from "react";

import { HandCoins } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import { settleOvertimeBonus } from "./actions";
import type { OvertimeBonusRow } from "./data";

export function OvertimeBonusCard({ bonuses }: { bonuses: OvertimeBonusRow[] }) {
  const t = useTranslations("Dashboard.payroll");
  const total = bonuses.reduce((sum, row) => sum + Number(row.bonus_amount), 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 font-normal">
              <HandCoins className="size-4" />
              {t("overtimeBonusTitle")}
            </CardTitle>
            <CardDescription>{t("overtimeBonusDescription")}</CardDescription>
          </div>
          <Badge variant="outline" className="w-fit">
            {formatCurrency(total, { currency: "EGP", noDecimals: true })}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("employee")}</TableHead>
                <TableHead>{t("overtimeBonusDate")}</TableHead>
                <TableHead>{t("overtimeBonusCoveringFor")}</TableHead>
                <TableHead className="text-end">{t("overtimeBonusAmount")}</TableHead>
                <TableHead className="text-end">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bonuses.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div className="font-medium">{row.employee?.name ?? `#${row.employee_id}`}</div>
                    <div className="text-muted-foreground text-xs">{row.employee?.role ?? t("staff")}</div>
                  </TableCell>
                  <TableCell>
                    <div>{row.date}</div>
                    <div className="text-muted-foreground text-xs">{row.shift?.name ?? "--"}</div>
                  </TableCell>
                  <TableCell>{row.covering_for?.name ?? "--"}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatCurrency(Number(row.bonus_amount), { currency: "EGP", noDecimals: true })}
                  </TableCell>
                  <TableCell className="text-end">
                    <SettleForm id={row.id} />
                  </TableCell>
                </TableRow>
              ))}
              {bonuses.length === 0 ? (
                <TableRow>
                  <TableCell className="h-24 text-center text-muted-foreground text-sm" colSpan={5}>
                    {t("overtimeBonusEmpty")}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function SettleForm({ id }: { id: number }) {
  const t = useTranslations("Dashboard.payroll");
  const [pending, startTransition] = React.useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const result = await settleOvertimeBonus(formData);

          if (result.ok) {
            toast.success(result.message);
            return;
          }

          toast.error(t("actionFailed"), { description: result.message });
        });
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? t("saving") : t("overtimeBonusMarkAdded")}
      </Button>
    </form>
  );
}
