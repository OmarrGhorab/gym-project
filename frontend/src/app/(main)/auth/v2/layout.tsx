import type { ReactNode } from "react";

import Image from "next/image";

import { getTranslations } from "next-intl/server";

import { Separator } from "@/components/ui/separator";

export default async function Layout({ children }: Readonly<{ children: ReactNode }>) {
  const t = await getTranslations("Auth.sidePanel");

  return (
    <main>
      <div className="grid h-dvh justify-center p-2 lg:grid-cols-2">
        <div className="relative order-2 hidden h-full overflow-hidden rounded-3xl bg-primary lg:flex">
          <Image
            src="/authentication-img.png"
            alt="ATP Gym training floor"
            fill
            priority
            className="object-cover"
            sizes="50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/25 to-black/75" />

          <div className="absolute bottom-10 flex w-full justify-between px-10">
            <div className="flex-1 space-y-1 text-white">
              <h2 className="font-medium">{t("frontDeskTitle")}</h2>
              <p className="text-sm text-white/75">{t("frontDeskDescription")}</p>
            </div>
            <Separator orientation="vertical" className="mx-3 h-auto! bg-white/25" />
            <div className="flex-1 space-y-1 text-white">
              <h2 className="font-medium">{t("secureTitle")}</h2>
              <p className="text-sm text-white/75">{t("secureDescription")}</p>
            </div>
          </div>
        </div>
        <div className="relative order-1 flex h-full">{children}</div>
      </div>
    </main>
  );
}
