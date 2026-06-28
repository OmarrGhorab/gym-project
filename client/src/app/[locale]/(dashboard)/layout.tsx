import { getCurrentUser, requireAuth } from "@/lib/session";
import { redirect } from "@/i18n/navigation";
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
  const user = await getCurrentUser();

  if (!user) {
    return redirect({ href: "/login", locale: locale as AppLocale });
  }

  return (
    <DashboardShell user={user}>
      {children}
    </DashboardShell>
  );
}
