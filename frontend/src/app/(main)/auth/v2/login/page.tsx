import Image from "next/image";
import Link from "next/link";

import { getTranslations } from "next-intl/server";

import { LanguageToggle } from "../../_components/language-toggle";
import { LoginForm } from "../../_components/login-form";
import { GoogleButton } from "../../_components/social-auth/google-button";

export default async function LoginV2() {
  const currentYear = new Date().getFullYear();
  const [tCommon, tLogin] = await Promise.all([getTranslations("Auth.common"), getTranslations("Auth.login")]);

  return (
    <>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-2 text-center">
          <div className="flex items-center justify-center gap-3">
            <Image src="/logo-noBG.png" alt="ATP Gym logo" width={42} height={42} className="object-contain" priority />
            <h1 className="font-medium text-3xl">{tLogin("title")}</h1>
          </div>
          <p className="text-muted-foreground text-sm">{tLogin("description")}</p>
        </div>
        <div className="space-y-3">
          <GoogleButton href="/api/auth/google/redirect" />
          <div className="flex items-center gap-3 text-muted-foreground text-xs">
            <span className="h-px flex-1 bg-border" />
            <span>{tLogin("emailDivider")}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
          <LoginForm />
          <Link
            prefetch={false}
            className="block text-center text-muted-foreground text-sm hover:text-foreground"
            href="forgot-password"
          >
            {tCommon("forgotPassword")}
          </Link>
        </div>
      </div>

      <div className="absolute top-5 flex w-full justify-end px-10">
        <div className="text-muted-foreground text-sm">
          {tLogin("newStaff")}{" "}
          <Link prefetch={false} className="text-foreground" href="register">
            {tCommon("register")}
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
