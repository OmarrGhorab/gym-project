"use client";

import * as React from "react";
import { PaymentDuesTable } from "@/components/payments/payment-dues-table";
import { PaymentFormDialog } from "@/components/payments/payment-form-dialog";
import type { PaymentDue } from "@/lib/api/dashboard";

export function PaymentDuesContainer({ dues }: { dues: PaymentDue[] }) {
  const [selectedDue, setSelectedDue] = React.useState<PaymentDue | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  function openCollectDialog(due: PaymentDue) {
    setSelectedDue(due);
    setIsDialogOpen(true);
  }

  return (
    <>
      <PaymentDuesTable dues={dues} onCollect={openCollectDialog} />
      <PaymentFormDialog
        due={selectedDue}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
