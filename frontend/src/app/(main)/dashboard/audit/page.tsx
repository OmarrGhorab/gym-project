import type { ReactNode } from "react";

import Link from "next/link";

import { FileClock } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormDatePicker, FormSelect } from "@/components/ui/form-controls";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { getAuditPageData } from "./_components/data";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    from?: string;
    to?: string;
    subject?: string;
    causer?: string;
    action?: string;
    log_name?: string;
    per_page?: string;
  }>;
}) {
  const query = await searchParams;
  const [data, t, locale] = await Promise.all([
    getAuditPageData(query),
    getTranslations("Dashboard.audit"),
    getLocale(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-lg border bg-muted text-muted-foreground">
              <FileClock className="size-4" />
            </div>
            <div>
              <CardTitle>{t("title")}</CardTitle>
              <CardDescription>{t("description")}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AuditFilters query={query} t={t} />
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("action")}</TableHead>
                  <TableHead>{t("descriptionColumn")}</TableHead>
                  <TableHead>{t("actor")}</TableHead>
                  <TableHead>{t("subject")}</TableHead>
                  <TableHead>{t("details")}</TableHead>
                  <TableHead className="text-end">{t("created")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.logs.length > 0 ? (
                  data.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        <span className="line-clamp-2">{log.description}</span>
                      </TableCell>
                      <TableCell>{log.causer?.name ?? log.causer_type ?? t("system")}</TableCell>
                      <TableCell>{formatSubject(log.subject)}</TableCell>
                      <TableCell className="min-w-80 max-w-xl">
                        <AuditDetails log={log} labels={detailLabels(t)} />
                      </TableCell>
                      <TableCell className="text-end text-muted-foreground">
                        {formatDate(log.created_at, locale)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      {t("empty")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <PageControls
            basePath="/dashboard/audit"
            meta={data.meta}
            query={query}
            t={{
              next: t("nextPage"),
              pageOf: formatPageInfo(data.meta.current_page ?? 1, data.meta.last_page ?? 1, locale),
              previous: t("previousPage"),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

type AuditLog = Awaited<ReturnType<typeof getAuditPageData>>["logs"][number];
type AuditLabels = Record<string, string>;
type AuditQuery = Parameters<typeof getAuditPageData>[0];

const subjectOptions = [
  "attendance",
  "commission",
  "employee",
  "expense",
  "inventory_movement",
  "member",
  "member_visit",
  "payment",
  "payroll",
  "plan",
  "product",
  "sale",
  "subscription",
  "subscription_freeze",
  "task",
] as const;

function AuditFilters({ query, t }: { query: AuditQuery; t: Awaited<ReturnType<typeof getTranslations>> }) {
  return (
    <form className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-3 xl:grid-cols-7">
      <FilterField label={t("filters.from")}>
        <FormDatePicker name="from" defaultValue={query?.from ?? ""} placeholder={t("filters.from")} />
      </FilterField>
      <FilterField label={t("filters.to")}>
        <FormDatePicker name="to" defaultValue={query?.to ?? ""} placeholder={t("filters.to")} />
      </FilterField>
      <FilterField label={t("filters.subject")}>
        <FormSelect
          name="subject"
          defaultValue={query?.subject ?? ""}
          options={subjectOptions.map((subject) => ({
            label: humanize(subject),
            value: subject,
          }))}
          placeholder={t("filters.allSubjects")}
        />
      </FilterField>
      <FilterField label={t("filters.action")}>
        <Input name="action" placeholder="created" defaultValue={query?.action ?? ""} />
      </FilterField>
      <FilterField label={t("filters.logName")}>
        <Input name="log_name" placeholder="sales" defaultValue={query?.log_name ?? ""} />
      </FilterField>
      <FilterField label={t("filters.causer")}>
        <Input type="number" name="causer" placeholder="1" defaultValue={query?.causer ?? ""} />
      </FilterField>
      <div className="flex items-end gap-2">
        <input type="hidden" name="per_page" value={query?.per_page ?? "20"} />
        <Button type="submit" className="flex-1">
          {t("filters.apply")}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/dashboard/audit" />}>
          {t("filters.clear")}
        </Button>
      </div>
    </form>
  );
}

function FilterField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="grid gap-1 text-sm">
      <span className="text-muted-foreground text-xs">{label}</span>
      {children}
    </div>
  );
}

function PageControls({
  basePath,
  meta,
  query,
  t,
}: {
  basePath: string;
  meta: Awaited<ReturnType<typeof getAuditPageData>>["meta"];
  query: AuditQuery;
  t: {
    next: string;
    pageOf: string;
    previous: string;
  };
}) {
  const currentPage = meta.current_page ?? 1;
  const lastPage = meta.last_page ?? 1;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{t.pageOf}</span>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={currentPage <= 1}
          render={<Link href={buildPageHref(basePath, query, currentPage - 1)} />}
        >
          {t.previous}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={currentPage >= lastPage}
          render={<Link href={buildPageHref(basePath, query, currentPage + 1)} />}
        >
          {t.next}
        </Button>
      </div>
    </div>
  );
}

function buildPageHref(basePath: string, query: AuditQuery, page: number) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value && key !== "page") {
      params.set(key, value);
    }
  }

  params.set("page", String(page));

  return `${basePath}?${params.toString()}`;
}

function AuditDetails({ log, labels }: { log: AuditLog; labels: AuditLabels }) {
  const rows = [
    ...flattenRecord(log.properties),
    ...flattenRecord(valueAt(log.changes, "attributes"), "new"),
    ...flattenRecord(valueAt(log.changes, "old"), "old"),
  ].filter((row) => !["attributes", "old"].includes(row.key));

  if (rows.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.slice(0, 8).map((row) => (
        <span key={`${row.scope}-${row.key}`} className="rounded-md border bg-muted/40 px-2 py-1 text-xs">
          <span className="text-muted-foreground">{labels[row.key] ?? humanize(row.key)}: </span>
          <span>{formatValue(row.value)}</span>
        </span>
      ))}
      {rows.length > 8 ? (
        <span className="rounded-md border bg-muted/40 px-2 py-1 text-muted-foreground text-xs">
          +{rows.length - 8}
        </span>
      ) : null}
    </div>
  );
}

function formatSubject(subject: AuditLog["subject"]) {
  if (!subject) {
    return "-";
  }

  if (subject.label) {
    return `${humanize(classBasename(subject.type))}: ${subject.label}`;
  }

  return `${humanize(classBasename(subject.type))} #${subject.id}`;
}

function formatPageInfo(page: number, total: number, locale: string) {
  const formatter = new Intl.NumberFormat(locale);

  if (locale.startsWith("ar")) {
    return `صفحة ${formatter.format(page)} من ${formatter.format(total)}`;
  }

  return `Page ${formatter.format(page)} of ${formatter.format(total)}`;
}

function detailLabels(t: Awaited<ReturnType<typeof getTranslations>>) {
  return {
    amount: t("fields.amount"),
    assigned_to: t("fields.assignedTo"),
    category: t("fields.category"),
    created_by: t("fields.createdBy"),
    date: t("fields.date"),
    employee: t("fields.employee"),
    employee_id: t("fields.employeeId"),
    items: t("fields.items"),
    member: t("fields.member"),
    member_id: t("fields.memberId"),
    member_name: t("fields.memberName"),
    month: t("fields.month"),
    movement: t("fields.movement"),
    net_salary: t("fields.netSalary"),
    new_stock: t("fields.newStock"),
    payment_method: t("fields.paymentMethod"),
    product: t("fields.product"),
    product_id: t("fields.productId"),
    reason: t("fields.reason"),
    sale_id: t("fields.saleId"),
    schedule_status: t("fields.scheduleStatus"),
    shift: t("fields.shift"),
    status: t("fields.status"),
    time: t("fields.time"),
    total: t("fields.total"),
  } satisfies AuditLabels;
}

function flattenRecord(value: unknown, scope = "properties") {
  if (!isRecord(value)) {
    return [];
  }

  return Object.entries(value)
    .filter(([, item]) => item !== null && item !== undefined && item !== "")
    .map(([key, item]) => ({ key, scope, value: item }));
}

function valueAt(value: unknown, key: string) {
  return isRecord(value) ? value[key] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(formatValue).join(", ");
  }

  if (isRecord(value)) {
    return Object.entries(value)
      .map(([key, item]) => `${humanize(key)}: ${formatValue(item)}`)
      .join(" · ");
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  return String(value);
}

function humanize(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function classBasename(value: string) {
  return value.split("\\").pop() ?? value;
}

function formatDate(value: string, locale: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
