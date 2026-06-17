import { getCurrentUser, requireAuth } from "@/lib/session";
import { getNotifications } from "@/lib/api/dashboard";
import type { AppLocale } from "@/i18n/routing";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function DashboardLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  await requireAuth(locale as AppLocale);
  const [user, notifications] = await Promise.all([
    getCurrentUser(),
    getNotifications({ limit: 10 }).catch(() => null),
  ]);

  return (
    <DashboardShell
      notifications={notifications?.data ?? []}
      unreadCount={notifications?.meta.total ?? 0}
      user={user}
    >
      {children}
    </DashboardShell>
  );
}
