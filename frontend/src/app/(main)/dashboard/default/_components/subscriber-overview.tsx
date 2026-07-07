"use client";

import { Download } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { StaffOption } from "../../members/_components/data";
import type { PlanRow } from "../../plans/_components/data";
import type { MembersMeta, MembersQuery } from "./data";
import type { RecentCustomerRow } from "./recent-customers-table/schema";
import { RecentCustomersTable } from "./recent-customers-table/table";

type SubscriberOverviewProps = {
  members: RecentCustomerRow[];
  total: number;
  meta: MembersMeta;
  query: MembersQuery;
  plans: PlanRow[];
  staff: StaffOption[];
};

export function SubscriberOverview({ members, total, meta, query, plans, staff }: SubscriberOverviewProps) {
  const t = useTranslations("Dashboard.default.members");
  const locale = useLocale();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="leading-none">
          {t("title", { count: new Intl.NumberFormat(locale).format(total) })}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm">
            <Download />
            {t("export")}
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-0">
        <RecentCustomersTable data={members} meta={meta} query={query} plans={plans} staff={staff} />
      </CardContent>
    </Card>
  );
}
