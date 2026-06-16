import { redirectIfAuthenticated } from "@/lib/session";
import type { AppLocale } from "@/i18n/routing";

export default async function AuthenticationLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  await redirectIfAuthenticated(locale as AppLocale);

  return children;
}
