import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { KeyRound, LockKeyhole, ShieldCheck, UserCog } from "lucide-react";
import {
  getPermissions,
  getRoles,
  type PermissionCatalog,
  type Role,
} from "@/lib/api/dashboard";
import Breadcrumb3 from "@/components/ui/breadcrumb-3";
import { RolesTableContainer } from "@/components/roles/roles-table-container";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "RolesPage" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default async function RolesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("RolesPage");
  const shellT = await getTranslations("DashboardShell");
  const isArabic = locale === "ar";
  const dateLocale = isArabic ? "ar-EG" : "en-US";
  const dateLabel = new Date().toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  let roles: Role[] = [];
  let permissions: PermissionCatalog = {};
  let fetchError: string | null = null;

  try {
    [roles, permissions] = await Promise.all([getRoles(), getPermissions()]);
  } catch {
    fetchError = t("fetchError");
  }

  const presetRoles = roles.filter((role) => role.is_preset).length;
  const customRoles = roles.length - presetRoles;
  const permissionCount = Object.values(permissions).reduce(
    (sum, group) => sum + group.length,
    0
  );
  const rolesWithPermissions = roles.filter(
    (role) => role.permissions.length > 0
  ).length;

  const stats = [
    {
      label: t("statTotal"),
      value: roles.length,
      hint: t("statTotalHint"),
      icon: ShieldCheck,
      className: "bg-primary/15 text-primary",
    },
    {
      label: t("statPreset"),
      value: presetRoles,
      hint: t("statPresetHint"),
      icon: LockKeyhole,
      className: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
    },
    {
      label: t("statCustom"),
      value: customRoles,
      hint: t("statCustomHint"),
      icon: UserCog,
      className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t("statPermissions"),
      value: permissionCount,
      hint: t("statPermissionsHint", { count: rolesWithPermissions }),
      icon: KeyRound,
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className={cn(isArabic && "text-right")}>
          <Breadcrumb3
            homeHref={`/${locale}`}
            homeLabel={shellT("nav.dashboard")}
            currentLabel={t("breadcrumb")}
            currentIcon={ShieldCheck}
            dateLabel={dateLabel}
            className={cn(isArabic && "flex justify-end")}
          />
          <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
            {t("description")}
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="rounded-lg shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-sm font-bold text-card-foreground">
                {stat.label}
              </CardTitle>
              <span
                className={cn(
                  "grid size-8 place-items-center rounded-lg",
                  stat.className
                )}
              >
                <stat.icon className="size-4" />
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-black tracking-tight text-foreground tabular-nums">
                {stat.value.toLocaleString(dateLocale)}
              </p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">
                {stat.hint}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      {fetchError && (
        <div className="rounded-md bg-destructive/10 p-4 text-sm font-medium text-destructive">
          {fetchError}
        </div>
      )}

      <Card className="overflow-hidden border shadow-xs">
        <div className="border-b bg-muted/15 px-4 py-4">
          <div className={cn(isArabic && "text-right")}>
            <h2 className="text-base font-black text-foreground">
              {t("tableTitle")}
            </h2>
            <p className="text-xs font-semibold text-muted-foreground">
              {t("tableDescription", { count: roles.length })}
            </p>
          </div>
        </div>
        <RolesTableContainer roles={roles} permissions={permissions} />
      </Card>
    </div>
  );
}
