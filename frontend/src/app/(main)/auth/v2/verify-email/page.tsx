import { Suspense } from "react";

import Link from "next/link";

import { getTranslations } from "next-intl/server";

import { LanguageToggle } from "../../_components/language-toggle";
import { VerifyEmailForm } from "../../_components/verify-email-form";

export default async function VerifyEmailPage() {
  const currentYear = new Date().getFullYear();
  const [tCommon, tVerify] = await Promise.all([getTranslations("Auth.common"), getTranslations("Auth.verifyEmail")]);

  return (
    <>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-2 text-center">
          <h1 className="font-medium text-3xl">{tVerify("title")}</h1>
          <p className="text-muted-foreground text-sm">{tVerify("description")}</p>
        </div>
        <Suspense fallback={null}>
          <VerifyEmailForm />
        </Suspense>
      </div>

      <div className="absolute top-5 flex w-full justify-end px-10">
        <div className="text-muted-foreground text-sm">
          {tCommon("alreadyVerified")}{" "}
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
