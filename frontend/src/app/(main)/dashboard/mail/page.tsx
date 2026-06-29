import { Bell, CheckCircle2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { getNotificationsPageData } from "./_components/data";

export default async function Page() {
  const notifications = await getNotificationsPageData();
  const unread = notifications.filter((notification) => !notification.read_at).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm">Backend notifications for renewals, reminders, and admin alerts.</p>
        </div>
        <Badge variant="outline">
          <Bell />
          {unread} unread
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-normal">Notification inbox</CardTitle>
          <CardDescription>Data comes from the authenticated Laravel notifications endpoint.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Notification</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {notifications.map((notification) => (
                <TableRow key={notification.id}>
                  <TableCell>
                    <div className="font-medium">{notificationTitle(notification.data)}</div>
                    <div className="line-clamp-1 text-muted-foreground text-xs">{notificationBody(notification.data)}</div>
                  </TableCell>
                  <TableCell>{notification.type.split("\\").pop()}</TableCell>
                  <TableCell>
                    <Badge variant={notification.read_at ? "secondary" : "outline"}>
                      {notification.read_at ? <CheckCircle2 /> : <Bell />}
                      {notification.read_at ? "Read" : "Unread"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(notification.created_at)}</TableCell>
                </TableRow>
              ))}
              {notifications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                    No notifications found.
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

function notificationTitle(data: Record<string, unknown>) {
  return String(data.title ?? data.subject ?? data.message ?? "Notification");
}

function notificationBody(data: Record<string, unknown>) {
  return String(data.body ?? data.description ?? data.member_name ?? data.plan_name ?? "");
}

function formatDate(value: string | null) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
