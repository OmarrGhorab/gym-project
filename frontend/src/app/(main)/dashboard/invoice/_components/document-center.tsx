"use client";

import { useState } from "react";

import Image from "next/image";

import { Download, FileArchive, IdCard, Printer, ReceiptText, ShieldAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";

import type { DocumentCenterData, DocumentMemberRow } from "./document-center-data";

export function DocumentCenter({ data }: { data: DocumentCenterData }) {
  const t = useTranslations("Dashboard.documents");
  const locale = useLocale();
  const firstMemberWithCode = data.members.find((member) => member.attendance_code || member.attendance_qr);
  const [selectedMember, setSelectedMember] = useState<DocumentMemberRow | null>(
    firstMemberWithCode ?? data.members[0] ?? null,
  );

  return (
    <Tabs defaultValue="payroll" className="gap-4">
      <TabsList className="w-full flex-wrap justify-start">
        <TabsTrigger value="payroll">
          <ReceiptText data-icon="inline-start" />
          {t("tabs.payroll")}
        </TabsTrigger>
        <TabsTrigger value="sales">
          <Printer data-icon="inline-start" />
          {t("tabs.receipts")}
        </TabsTrigger>
        <TabsTrigger value="members">
          <IdCard data-icon="inline-start" />
          {t("tabs.memberQr")}
        </TabsTrigger>
        <TabsTrigger value="attendance">
          <ShieldAlert data-icon="inline-start" />
          {t("tabs.attendance")}
        </TabsTrigger>
        <TabsTrigger value="exports">
          <FileArchive data-icon="inline-start" />
          {t("tabs.exports")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="payroll">
        <Card>
          <CardHeader>
            <CardTitle>{t("salaryReceipts")}</CardTitle>
            <CardDescription>{t("salaryReceiptsDescription", { count: data.payroll.length })}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("employee")}</TableHead>
                  <TableHead>{t("month")}</TableHead>
                  <TableHead>{t("deductions")}</TableHead>
                  <TableHead>{t("netSalary")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-end">{t("download")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payroll.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">
                        {row.employee.name ?? t("employeeFallback", { id: row.employee.id })}
                      </div>
                      <div className="text-muted-foreground text-xs">{row.employee.role ?? t("staff")}</div>
                    </TableCell>
                    <TableCell>{row.month}</TableCell>
                    <TableCell>{money(row.deductions)}</TableCell>
                    <TableCell className="font-medium">{money(row.net_salary)}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === "paid" ? "secondary" : "outline"}>{cleanLabel(row.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        render={<a href={`/api/payroll/${row.id}/payslip`} />}
                        nativeButton={false}
                        size="sm"
                        variant="outline"
                      >
                        <Download data-icon="inline-start" />
                        PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {data.payroll.length === 0 ? <EmptyRow colSpan={6} label={t("noPayrollReceipts")} /> : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="sales">
        <Card>
          <CardHeader>
            <CardTitle>{t("posSaleReceipts")}</CardTitle>
            <CardDescription>{t("posSaleReceiptsDescription", { count: data.sales.length })}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("sale")}</TableHead>
                  <TableHead>{t("customer")}</TableHead>
                  <TableHead>{t("seller")}</TableHead>
                  <TableHead>{t("total")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-end">{t("receipt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>
                      <div className="font-medium">{t("saleNumber", { id: sale.id })}</div>
                      <div className="text-muted-foreground text-xs">{formatDateTime(sale.created_at, locale, t)}</div>
                    </TableCell>
                    <TableCell>
                      {sale.member?.name ??
                        (sale.member_id ? t("memberFallback", { id: sale.member_id }) : t("walkIn"))}
                    </TableCell>
                    <TableCell>{sale.sold_by?.name ?? t("posStaff")}</TableCell>
                    <TableCell className="font-medium">{money(sale.total)}</TableCell>
                    <TableCell>
                      <Badge variant={sale.status === "completed" ? "secondary" : "outline"}>
                        {cleanLabel(sale.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <Button
                        render={<a href={`/api/sales/${sale.id}/receipt`} />}
                        nativeButton={false}
                        size="sm"
                        variant="outline"
                      >
                        <Download data-icon="inline-start" />
                        PDF
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {data.sales.length === 0 ? <EmptyRow colSpan={6} label={t("noSaleReceipts")} /> : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="members">
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle>{t("memberQrCards")}</CardTitle>
              <CardDescription>{t("memberQrDescription", { count: data.members.length })}</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("member")}</TableHead>
                    <TableHead>{t("plan")}</TableHead>
                    <TableHead>{t("qrPayload")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.members.map((member) => (
                    <TableRow
                      key={member.id}
                      className="cursor-pointer"
                      data-state={selectedMember?.id === member.id ? "selected" : undefined}
                      onClick={() => setSelectedMember(member)}
                    >
                      <TableCell>
                        <button type="button" className="grid text-left" onClick={() => setSelectedMember(member)}>
                          <span className="font-medium">{member.name}</span>
                          <span className="text-muted-foreground text-xs">{member.phone}</span>
                        </button>
                      </TableCell>
                      <TableCell>
                        <div>{member.latest_subscription?.plan_name ?? t("noActivePlan")}</div>
                        <div className="text-muted-foreground text-xs">
                          {t("ends", { date: member.latest_subscription?.end_date ?? t("notSet") })}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {member.attendance_qr ?? member.attendance_code ?? t("missing")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.status === "active" ? "secondary" : "outline"}>
                          {cleanLabel(member.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.members.length === 0 ? <EmptyRow colSpan={4} label={t("noMembers")} /> : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <MemberQrPreview member={selectedMember} />
        </div>
      </TabsContent>

      <TabsContent value="attendance">
        <Card>
          <CardHeader>
            <CardTitle>{t("attendanceSummaries")}</CardTitle>
            <CardDescription>{t("attendanceSummariesDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("employee")}</TableHead>
                  <TableHead>{t("month")}</TableHead>
                  <TableHead>{t("present")}</TableHead>
                  <TableHead>{t("absent")}</TableHead>
                  <TableHead>{t("stillIn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.attendance.summary.map((row) => (
                  <TableRow key={`${row.employee_id}-${row.month}`}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-muted-foreground text-xs">{row.role}</div>
                    </TableCell>
                    <TableCell>{row.month}</TableCell>
                    <TableCell>{row.present_count}</TableCell>
                    <TableCell>{row.absent_count}</TableCell>
                    <TableCell>{row.open_count}</TableCell>
                  </TableRow>
                ))}
                {data.attendance.summary.length === 0 ? (
                  <EmptyRow colSpan={5} label={t("noAttendanceSummaries")} />
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="exports">
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t("financeWorkbook")}</CardTitle>
              <CardDescription>{t("financeWorkbookDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button render={<a href="/api/finance/export" />} nativeButton={false}>
                <Download data-icon="inline-start" />
                {t("downloadFinanceReport")}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("documentReadiness")}</CardTitle>
              <CardDescription>{t("documentReadinessDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Readiness label={t("payrollPdfRoute")} ready={data.payroll.length > 0} />
              <Readiness label={t("saleReceiptPdfRoute")} ready={data.sales.length > 0} />
              <Readiness label={t("memberQrPayloads")} ready={data.members.some((member) => member.attendance_code)} />
              <Readiness label={t("attendanceSummary")} ready={data.attendance.summary.length > 0} />
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function MemberQrPreview({ member }: { member: DocumentMemberRow | null }) {
  const t = useTranslations("Dashboard.documents");
  const payload = member?.attendance_qr ?? member?.attendance_code ?? null;
  const qrUrl = payload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(payload)}`
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("printableQrCard")}</CardTitle>
        <CardDescription>{t("printableQrDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {member ? (
          <div className="rounded-xl border bg-background p-5 text-center">
            <div className="mx-auto flex size-44 items-center justify-center rounded-lg border bg-muted/40 p-4">
              {qrUrl ? (
                <Image
                  src={qrUrl}
                  alt={t("printableQrCard")}
                  width={220}
                  height={220}
                  unoptimized
                  className="size-full rounded-lg object-contain"
                />
              ) : (
                <IdCard className="size-12 text-muted-foreground" />
              )}
            </div>
            <div className="mt-4 font-medium">{member.name}</div>
            <div className="text-muted-foreground text-sm">{member.phone}</div>
            <div className="mt-3 rounded-md bg-muted px-3 py-2 font-mono text-xs">{payload ?? t("qrCodeMissing")}</div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
            {t("addMembers")}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Readiness({ label, ready }: { label: string; ready: boolean }) {
  const t = useTranslations("Dashboard.documents");

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <span>{label}</span>
      <Badge variant={ready ? "secondary" : "outline"}>{ready ? t("ready") : t("noRowsYet")}</Badge>
    </div>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <TableRow>
      <TableCell colSpan={colSpan} className="py-8 text-center text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );
}

function cleanLabel(value: string) {
  return value.replace(/[_-]/g, " ");
}

function formatDateTime(
  value: string | null,
  locale: string,
  t: ReturnType<typeof useTranslations<"Dashboard.documents">>,
) {
  if (!value) {
    return t("notRecorded");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function money(value: string) {
  return formatCurrency(Number(value || 0), { currency: "EGP", noDecimals: true });
}
