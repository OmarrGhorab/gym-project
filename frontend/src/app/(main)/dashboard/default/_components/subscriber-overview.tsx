"use client";

import { Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { canAccess } from "@/lib/authorization";
import type { DashboardUser } from "@/lib/session";

import type { StaffOption } from "../../members/_components/data";
import type { PlanRow } from "../../plans/_components/data";
import type { MembersMeta, MembersQuery } from "./data";
import type { RecentCustomerRow } from "./recent-customers-table/schema";
import { RecentCustomersTable } from "./recent-customers-table/table";

type SubscriberOverviewProps = {
  members: RecentCustomerRow[];
  frozenMembers: RecentCustomerRow[];
  frozenMembersTotal: number;
  total: number;
  meta: MembersMeta;
  query: MembersQuery;
  plans: PlanRow[];
  staff: StaffOption[];
  user: DashboardUser;
};

export function SubscriberOverview({
  members,
  frozenMembers,
  frozenMembersTotal,
  total,
  meta,
  query,
  plans,
  staff,
  user,
}: SubscriberOverviewProps) {
  const t = useTranslations("Dashboard.default.members");
  const locale = useLocale();
  const canExportMembers = canAccess(user, "export.members");

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="leading-none">
            {t("title", { count: new Intl.NumberFormat(locale).format(total) })}
          </CardTitle>
          <CardDescription>{t("description")}</CardDescription>
          {canExportMembers ? (
            <CardAction>
              <Button variant="outline" size="sm">
                <Download />
                {t("export")}
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>

        <CardContent className="pt-0">
          <RecentCustomersTable data={members} meta={meta} query={query} plans={plans} staff={staff} user={user} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="leading-none">
            {t("frozenTitle", { count: new Intl.NumberFormat(locale).format(frozenMembersTotal) })}
          </CardTitle>
          <CardDescription>{t("frozenDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          <RecentCustomersTable
            compact
            data={frozenMembers}
            meta={{
              currentPage: 1,
              perPage: Math.max(frozenMembers.length, 1),
              total: frozenMembersTotal,
              lastPage: 1,
            }}
            query={{ status: "frozen" }}
            plans={plans}
            staff={staff}
            user={user}
          />
        </CardContent>
      </Card>
    </>
  );
}
