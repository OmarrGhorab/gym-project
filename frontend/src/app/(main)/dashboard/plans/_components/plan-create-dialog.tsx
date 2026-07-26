"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useQueryDialog } from "@/hooks/use-query-dialog";

import type { PlanCategoryOption, PlanEmployeeOption, PlanRow } from "./data";
import { PlanCreateForm } from "./plan-create-form";

type PlanCreateDialogProps = {
  categories?: PlanCategoryOption[];
  employees: PlanEmployeeOption[];
  plans: PlanRow[];
};

export function PlanCreateDialog({ categories, employees, plans }: PlanCreateDialogProps) {
  const t = useTranslations("Dashboard.plans");
  const { onOpenChange, open } = useQueryDialog("create-plan");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger render={<Button />}>
        <Plus />
        {t("createPlan")}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("createPlan")}</DialogTitle>
          <DialogDescription>{t("createDescription")}</DialogDescription>
        </DialogHeader>
        <PlanCreateForm
          availablePlans={plans}
          categories={categories}
          employees={employees}
          onSuccess={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
