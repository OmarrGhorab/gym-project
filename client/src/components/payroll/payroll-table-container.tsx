"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PayrollAdjustDialog } from "@/components/payroll/payroll-adjust-dialog";
import { PayrollGenerateDialog } from "@/components/payroll/payroll-generate-dialog";
import { PayrollTable } from "@/components/payroll/payroll-table";
import type { Payroll } from "@/lib/api/dashboard";

export function PayrollTableContainer({ payroll }: { payroll: Payroll[] }) {
  const t = useTranslations("PayrollPage");
  const [isGenerateOpen, setIsGenerateOpen] = React.useState(false);
  const [selectedPayroll, setSelectedPayroll] = React.useState<Payroll | null>(null);
  const [isAdjustOpen, setIsAdjustOpen] = React.useState(false);

  function openAdjustDialog(item: Payroll) {
    setSelectedPayroll(item);
    setIsAdjustOpen(true);
  }

  return (
    <>
      <div className="flex items-center justify-end border-b px-4 py-3">
        <Button type="button" size="sm" onClick={() => setIsGenerateOpen(true)}>
          <Plus className="size-4" />
          {t("generateButton")}
        </Button>
      </div>
      <PayrollTable payroll={payroll} onAdjust={openAdjustDialog} />
      <PayrollGenerateDialog open={isGenerateOpen} onOpenChange={setIsGenerateOpen} />
      <PayrollAdjustDialog
        payroll={selectedPayroll}
        open={isAdjustOpen}
        onOpenChange={setIsAdjustOpen}
      />
    </>
  );
}
