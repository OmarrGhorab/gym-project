"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PlanFormDialog } from "@/components/plans/plan-form-dialog";
import { PlansTable } from "@/components/plans/plans-table";
import type { Plan } from "@/lib/api/dashboard";

export function PlansTableContainer({ plans }: { plans: Plan[] }) {
  const router = useRouter();
  const t = useTranslations("PlansPage");
  const [dialogMode, setDialogMode] = React.useState<"add" | "edit">("add");
  const [selectedPlan, setSelectedPlan] = React.useState<Plan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  function openAddDialog() {
    setDialogMode("add");
    setSelectedPlan(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(plan: Plan) {
    setDialogMode("edit");
    setSelectedPlan(plan);
    setIsDialogOpen(true);
  }

  function handleSuccess() {
    router.refresh();
  }

  return (
    <>
      <div className="flex items-center justify-end border-b px-4 py-3">
        <Button type="button" size="sm" onClick={openAddDialog}>
          <Plus className="size-4" />
          {t("addButton")}
        </Button>
      </div>

      <PlansTable plans={plans} onEdit={openEditDialog} />

      <PlanFormDialog
        mode={dialogMode}
        plan={selectedPlan}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSuccess={handleSuccess}
      />
    </>
  );
}
