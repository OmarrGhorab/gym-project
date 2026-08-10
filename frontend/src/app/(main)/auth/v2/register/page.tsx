import Link from "next/link";

import { getTranslations } from "next-intl/server";

import { redirectIfAuthenticated } from "@/lib/session";

import { LanguageToggle } from "../../_components/language-toggle";
import { RegisterForm } from "../../_components/register-form";

export default async function RegisterV2() {
  await redirectIfAuthenticated();

  const currentYear = new Date().getFullYear();
  const [tCommon, tRegister] = await Promise.all([getTranslations("Auth.common"), getTranslations("Auth.register")]);

  return (
    <>
      <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[350px]">
        <div className="space-y-2 text-center">
          <h1 className="font-medium text-3xl">{tRegister("title")}</h1>
          <p className="text-muted-foreground text-sm">{tRegister("description")}</p>
        </div>
        <div className="space-y-4">
          <RegisterForm />
        </div>
      </div>

      <div className="absolute top-5 flex w-full justify-end px-10">
        <div className="text-muted-foreground text-sm">
          {tRegister("alreadyOnTeam")}{" "}
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
