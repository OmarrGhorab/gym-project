"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { RecentCustomerRow } from "./recent-customers-table/schema";
import { RecentCustomersTable } from "./recent-customers-table/table";

type SubscriberOverviewProps = {
  members: RecentCustomerRow[];
  total: number;
};

export function SubscriberOverview({ members, total }: SubscriberOverviewProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="leading-none">{total.toLocaleString("en-US")} Members</CardTitle>
        <CardDescription>Recent member records with plan, payment, status, and signup activity.</CardDescription>
        <CardAction>
          <Button variant="outline" size="sm">
            <Download />
            Export
          </Button>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-0">
        <RecentCustomersTable data={members} />
      </CardContent>
    </Card>
  );
}
