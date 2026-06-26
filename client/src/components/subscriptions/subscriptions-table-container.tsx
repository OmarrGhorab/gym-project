"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SubscriptionFormDialog } from "@/components/subscriptions/subscription-form-dialog";
import { SubscriptionsTable } from "@/components/subscriptions/subscriptions-table";
import type { Member, Plan, Subscription } from "@/lib/api/dashboard";

type SubscriptionsTableContainerProps = {
  subscriptions: Subscription[];
  members: Member[];
  plans: Plan[];
};

export function SubscriptionsTableContainer({
  subscriptions,
  members,
  plans,
}: SubscriptionsTableContainerProps) {
  const t = useTranslations("SubscriptionsPage");
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  return (
    <>
      <div className="flex items-center justify-end border-b px-4 py-3">
        <Button type="button" size="sm" onClick={() => setIsDialogOpen(true)}>
          <Plus className="size-4" />
          {t("newSubscriptionButton")}
        </Button>
      </div>
      <SubscriptionsTable subscriptions={subscriptions} />
      <SubscriptionFormDialog
        members={members}
        plans={plans}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
