import Link from "next/link";

import { getTranslations } from "next-intl/server";

import { ForgotPasswordForm } from "../../_components/forgot-password-form";
import { LanguageToggle } from "../../_components/language-toggle";

export default async function ForgotPasswordPage() {
  const currentYear = new Date().getFullYear();
  const [tCommon, tForgot] = await Promise.all([getTranslations("Auth.common"), getTranslations("Auth.forgot")]);

  return (
    <>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-2 text-center">
          <h1 className="font-medium text-3xl">{tForgot("title")}</h1>
          <p className="text-muted-foreground text-sm">{tForgot("description")}</p>
        </div>
        <ForgotPasswordForm />
      </div>

      <div className="absolute top-5 flex w-full justify-end px-10">
        <div className="text-muted-foreground text-sm">
          {tCommon("rememberPassword")}{" "}
          <Link prefetch={false} className="text-foreground" href="login">
            {tCommon("login")}
          </Link>
        </div>
      </div>

      <div className="absolute bottom-5 flex w-full justify-between px-10">
        <div className="text-sm">{tCommon("copyright", { year: currentYear })}</div>
        <LanguageToggle />
      </div>
    </>
  );
}
