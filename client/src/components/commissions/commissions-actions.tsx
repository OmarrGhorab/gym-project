"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CommissionBackfillDialog } from "@/components/commissions/commission-backfill-dialog";

export function CommissionsActions() {
  const t = useTranslations("CommissionsPage");
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <Button type="button" size="sm" onClick={() => setIsOpen(true)}>
        <RotateCcw className="size-4" />
        {t("backfillButton")}
      </Button>
      <CommissionBackfillDialog open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
