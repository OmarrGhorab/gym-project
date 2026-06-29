"use client";

import { Download, FileArchive, IdCard, Printer, ReceiptText, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";

import type { DocumentCenterData, DocumentMemberRow } from "./document-center-data";

const qrPreviewCells = Array.from({ length: 25 }, (_, index) => ({
  filled: index % 2 === 0 || index % 7 === 0,
  id: `qr-cell-${index}`,
}));

export function DocumentCenter({ data }: { data: DocumentCenterData }) {
  const firstMemberWithCode = data.members.find((member) => member.attendance_code || member.attendance_qr);

  return (
    <Tabs defaultValue="payroll" className="gap-4">
      <TabsList className="w-full flex-wrap justify-start">
        <TabsTrigger value="payroll">
          <ReceiptText data-icon="inline-start" />
          Payroll
        </TabsTrigger>
        <TabsTrigger value="sales">
          <Printer data-icon="inline-start" />
          Receipts
        </TabsTrigger>
        <TabsTrigger value="members">
          <IdCard data-icon="inline-start" />
          Member QR
        </TabsTrigger>
        <TabsTrigger value="attendance">
          <ShieldAlert data-icon="inline-start" />
          Attendance
        </TabsTrigger>
        <TabsTrigger value="exports">
          <FileArchive data-icon="inline-start" />
          Exports
        </TabsTrigger>
      </TabsList>

      <TabsContent value="payroll">
        <Card>
          <CardHeader>
            <CardTitle>Salary Receipts</CardTitle>
            <CardDescription>Download backend-generated salary receipts with attendance deductions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Attendance deductions</TableHead>
                  <TableHead>Net salary</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Download</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payroll.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.employee.name ?? `Employee #${row.employee.id}`}</div>
                      <div className="text-muted-foreground text-xs">{row.employee.role ?? "Staff"}</div>
                    </TableCell>
                    <TableCell>{row.month}</TableCell>
                    <TableCell>{money(row.attendance_deductions)}</TableCell>
                    <TableCell className="font-medium">{money(row.net_salary)}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === "paid" ? "secondary" : "outline"}>{cleanLabel(row.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
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
                {data.payroll.length === 0 ? <EmptyRow colSpan={6} label="No payroll receipts yet." /> : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="sales">
        <Card>
          <CardHeader>
            <CardTitle>POS Sale Receipts</CardTitle>
            <CardDescription>
              Recent sales can be reprinted or downloaded through the authenticated PDF proxy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sale</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Receipt</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell>
                      <div className="font-medium">Sale #{sale.id}</div>
                      <div className="text-muted-foreground text-xs">{formatDateTime(sale.created_at)}</div>
                    </TableCell>
                    <TableCell>
                      {sale.member?.name ?? (sale.member_id ? `Member #${sale.member_id}` : "Walk-in")}
                    </TableCell>
                    <TableCell>{sale.sold_by?.name ?? "POS staff"}</TableCell>
                    <TableCell className="font-medium">{money(sale.total)}</TableCell>
                    <TableCell>
                      <Badge variant={sale.status === "completed" ? "secondary" : "outline"}>
                        {cleanLabel(sale.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
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
                {data.sales.length === 0 ? <EmptyRow colSpan={6} label="No sale receipts yet." /> : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="members">
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle>Member QR Cards</CardTitle>
              <CardDescription>Use these codes for front-desk check-in/out scanning.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>QR payload</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-muted-foreground text-xs">{member.phone}</div>
                      </TableCell>
                      <TableCell>
                        <div>{member.latest_subscription?.plan_name ?? "No active plan"}</div>
                        <div className="text-muted-foreground text-xs">
                          Ends {member.latest_subscription?.end_date ?? "not set"}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {member.attendance_qr ?? member.attendance_code ?? "Missing"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.status === "active" ? "secondary" : "outline"}>
                          {cleanLabel(member.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {data.members.length === 0 ? <EmptyRow colSpan={4} label="No members available." /> : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <MemberQrPreview member={firstMemberWithCode ?? data.members[0] ?? null} />
        </div>
      </TabsContent>

      <TabsContent value="attendance">
        <Card>
          <CardHeader>
            <CardTitle>Attendance Summaries</CardTitle>
            <CardDescription>Monthly staff attendance figures used by payroll and warnings.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Present</TableHead>
                  <TableHead>Late</TableHead>
                  <TableHead>Absent</TableHead>
                  <TableHead>Late minutes</TableHead>
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
                    <TableCell>{row.late_count}</TableCell>
                    <TableCell>{row.absent_count}</TableCell>
                    <TableCell>{row.late_minutes}</TableCell>
                  </TableRow>
                ))}
                {data.attendance.summary.length === 0 ? (
                  <EmptyRow colSpan={6} label="No attendance summaries yet." />
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
              <CardTitle>Finance Workbook</CardTitle>
              <CardDescription>Exports the current year financial report as an XLSX file.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button render={<a href="/api/finance/export" />} nativeButton={false}>
                <Download data-icon="inline-start" />
                Download finance report
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Document Readiness</CardTitle>
              <CardDescription>Backend-backed document sources currently connected to this dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Readiness label="Payroll PDF route" ready={data.payroll.length > 0} />
              <Readiness label="Sale receipt PDF route" ready={data.sales.length > 0} />
              <Readiness label="Member QR payloads" ready={data.members.some((member) => member.attendance_code)} />
              <Readiness label="Attendance summary" ready={data.attendance.summary.length > 0} />
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function MemberQrPreview({ member }: { member: DocumentMemberRow | null }) {
  const payload = member?.attendance_qr ?? member?.attendance_code ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Printable QR Card</CardTitle>
        <CardDescription>Front desk can print this card from the browser for physical scanning.</CardDescription>
      </CardHeader>
      <CardContent>
        {member ? (
          <div className="rounded-xl border bg-background p-5 text-center">
            <div className="mx-auto flex size-44 items-center justify-center rounded-lg border bg-muted/40 p-4">
              <div className="grid size-32 grid-cols-5 gap-1">
                {qrPreviewCells.map((cell) => (
                  <span
                    key={`${member.id}-${cell.id}`}
                    className={cell.filled ? "rounded-sm bg-foreground" : "rounded-sm bg-background"}
                  />
                ))}
              </div>
            </div>
            <div className="mt-4 font-medium">{member.name}</div>
            <div className="text-muted-foreground text-sm">{member.phone}</div>
            <div className="mt-3 rounded-md bg-muted px-3 py-2 font-mono text-xs">{payload ?? "QR code missing"}</div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">
            Add members to generate printable cards.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Readiness({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <span>{label}</span>
      <Badge variant={ready ? "secondary" : "outline"}>{ready ? "Ready" : "No rows yet"}</Badge>
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

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function money(value: string) {
  return formatCurrency(Number(value || 0), { currency: "EGP", noDecimals: true });
}
