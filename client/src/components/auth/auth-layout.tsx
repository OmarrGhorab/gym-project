"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";

export type AuthLayoutProps = {
  children: React.ReactNode;
};

export function AuthLayout({ children }: AuthLayoutProps) {
  const locale = useLocale();
  const isArabic = locale === "ar";

  return (
    <main className="relative flex min-h-screen w-full bg-[radial-gradient(circle_at_top,_rgba(255,232,96,0.16),_transparent_26%),linear-gradient(180deg,_#090909_0%,_#111111_100%)] text-slate-900">
      <section className="relative hidden w-1/2 bg-black lg:block">
        <Image
          src="/authentication-img.jpeg"
          alt="Authentication"
          fill
          priority
          className="object-cover object-center"
        />
      </section>

      <section
        className="relative flex w-full items-center justify-center bg-[linear-gradient(180deg,rgba(255,252,242,0.98),rgba(246,240,223,0.98))] px-6 py-8 dark:bg-[linear-gradient(180deg,rgba(22,22,22,0.98),rgba(14,14,14,0.98))] sm:px-10 lg:w-1/2 lg:px-14"
      >
        <Link
          href="/"
          className={`absolute top-6 transition-opacity hover:opacity-80 ${
            isArabic ? "left-6 lg:left-14" : "right-6 lg:right-14"
          }`}
        >
          <Image
            src="/logo.jpeg"
            alt="ATP Gym"
            width={96}
            height={96}
            className="h-14 w-auto rounded-lg object-contain shadow-lg"
          />
        </Link>

        <div
          className={`w-full max-w-md ${isArabic ? "rtl" : "ltr"}`}
        >
          {children}
        </div>
      </section>
    </main>
  );
}
