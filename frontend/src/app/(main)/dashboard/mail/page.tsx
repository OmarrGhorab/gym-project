import type { ReactNode } from "react";

import Link from "next/link";

import { Bell, CheckCircle2, Download, ExternalLink } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormSelect } from "@/components/ui/form-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { WhatsAppNotificationButton } from "@/components/whatsapp-notification-button";

import { markNotificationRead } from "./_components/actions";
import { getNotificationsPageData } from "./_components/data";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    category?: string;
    per_page?: string;
  }>;
}) {
  const query = await searchParams;
  const t = await getTranslations("Dashboard.mail");
  const locale = await getLocale();
  const { meta, notifications } = await getNotificationsPageData(query);
  const unread = notifications.filter((notification) => !notification.read_at).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <Badge variant="outline">
          <Bell />
          {t("unread", { count: unread })}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-normal">{t("inbox")}</CardTitle>
          <CardDescription>{t("inboxDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <NotificationFilters query={query} t={t} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("notification")}</TableHead>
                <TableHead>{t("type")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("created")}</TableHead>
                <TableHead className="text-end">{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.map((notification) => (
                <TableRow key={notification.id}>
                  <TableCell>
                    <div className="font-medium">{notificationTitle(notification.data, t)}</div>
                    <div className="line-clamp-1 text-muted-foreground text-xs">
                      {notificationBody(notification.data)}
                    </div>
                  </TableCell>
                  <TableCell>{notification.type.split("\\").pop()}</TableCell>
                  <TableCell>
                    <Badge variant={notification.read_at ? "secondary" : "outline"}>
                      {notification.read_at ? <CheckCircle2 /> : <Bell />}
                      {notification.read_at ? t("read") : t("unreadStatus")}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(notification.created_at, locale, t)}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      <NotificationPayloadActions data={notification.data} t={t} />
                      {!notification.read_at ? (
                        <form action={markNotificationRead}>
                          <input type="hidden" name="id" value={notification.id} />
                          <Button type="submit" size="sm" variant="outline">
                            {t("markRead")}
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {notifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {t("empty")}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
          <PageControls
            basePath="/dashboard/mail"
            meta={meta}
            query={query}
            t={{
              next: t("nextPage"),
              pageOf: t("pageOf", {
                page: meta.current_page ?? 1,
                total: meta.last_page ?? 1,
              }),
              previous: t("previousPage"),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

type NotificationQuery = Parameters<typeof getNotificationsPageData>[0];

const notificationCategoryOptions = [
  "attendance.bonus",
  "attendance.deduction",
  "attendance.deduction_pending",
  "attendance.late",
  "attendance.off_shift",
  "attendance.warning",
  "expenses.created",
  "inventory.low_stock",
  "membership.cancelled_refund",
  "membership.expiring_soon",
  "membership.sessions_finished",
  "membership.subscription_created",
  "payroll.paid",
  "payroll.ready",
  "tasks.assigned",
] as const;

function NotificationFilters({
  query,
  t,
}: {
  query: NotificationQuery;
  t: Awaited<ReturnType<typeof getTranslations<"Dashboard.mail">>>;
}) {
  return (
    <form className="grid gap-3 rounded-lg border bg-muted/20 p-3 md:grid-cols-[1fr_1fr_auto]">
      <FilterField label={t("filters.status")}>
        <FormSelect
          name="status"
          defaultValue={query?.status ?? "all"}
          options={[
            { label: t("filters.all"), value: "all" },
            { label: t("filters.unread"), value: "unread" },
            { label: t("filters.read"), value: "read" },
          ]}
        />
      </FilterField>
      <FilterField label={t("filters.category")}>
        <FormSelect
          name="category"
          defaultValue={query?.category ?? ""}
          placeholder={t("filters.allCategories")}
          options={notificationCategoryOptions.map((category) => ({
            label: humanizeCategory(category),
            value: category,
          }))}
        />
      </FilterField>
      <div className="flex items-end gap-2">
        <input type="hidden" name="per_page" value={query?.per_page ?? "15"} />
        <Button type="submit">{t("filters.apply")}</Button>
        <Button type="button" variant="outline" render={<Link href="/dashboard/mail" />}>
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

function NotificationPayloadActions({
  data,
  t,
}: {
  data: Record<string, unknown>;
  t: Awaited<ReturnType<typeof getTranslations<"Dashboard.mail">>>;
}) {
  const payslipUrl = safeRelativeHref(data.payslip_url);
  const url = safeRelativeHref(data.url);
  const phone = (data.member_phone ?? data.phone) as string | undefined;

  return (
    <>
      {phone ? <WhatsAppNotificationButton phone={phone} data={data} size="sm" /> : null}
      {payslipUrl ? (
        <Button size="sm" variant="outline" render={<a href={payslipUrl} />}>
          <Download data-icon="inline-start" />
          {t("downloadReport")}
        </Button>
      ) : null}
      {url && url !== payslipUrl ? (
        <Button size="sm" variant="outline" render={<Link href={url} />}>
          <ExternalLink data-icon="inline-start" />
          {t("open")}
        </Button>
      ) : null}
    </>
  );
}

function PageControls({
  basePath,
  meta,
  query,
  t,
}: {
  basePath: string;
  meta: Awaited<ReturnType<typeof getNotificationsPageData>>["meta"];
  query: NotificationQuery;
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

function buildPageHref(basePath: string, query: NotificationQuery, page: number) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query ?? {})) {
    if (value && key !== "page") {
      params.set(key, value);
    }
  }

  params.set("page", String(page));

  return `${basePath}?${params.toString()}`;
}

function notificationTitle(
  data: Record<string, unknown>,
  t: Awaited<ReturnType<typeof getTranslations<"Dashboard.mail">>>,
) {
  return String(data.title ?? data.subject ?? data.message ?? t("fallbackTitle"));
}

function notificationBody(data: Record<string, unknown>) {
  return String(data.body ?? data.description ?? data.member_name ?? data.plan_name ?? "");
}

function safeRelativeHref(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/")) {
    return null;
  }

  if (value.startsWith("//")) {
    return null;
  }

  return value;
}

function formatDate(
  value: string | null,
  locale: string,
  t: Awaited<ReturnType<typeof getTranslations<"Dashboard.mail">>>,
) {
  if (!value) {
    return t("notRecorded");
  }

  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function humanizeCategory(value: string) {
  return value
    .replaceAll(".", " / ")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
