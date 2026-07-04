import { Bell, CheckCircle2 } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { markNotificationRead } from "./_components/actions";
import { getNotificationsPageData } from "./_components/data";

export default async function Page() {
  const t = await getTranslations("Dashboard.mail");
  const locale = await getLocale();
  const notifications = await getNotificationsPageData();
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
        <CardContent>
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
                  <TableCell className="text-end">
                    {!notification.read_at ? (
                      <form action={markNotificationRead}>
                        <input type="hidden" name="id" value={notification.id} />
                        <Button type="submit" size="sm" variant="outline">
                          {t("markRead")}
                        </Button>
                      </form>
                    ) : null}
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
        </CardContent>
      </Card>
    </div>
  );
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
