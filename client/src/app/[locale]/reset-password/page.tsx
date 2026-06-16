import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import { AuthLayout } from "@/components/auth/auth-layout";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <AuthLayout>
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
