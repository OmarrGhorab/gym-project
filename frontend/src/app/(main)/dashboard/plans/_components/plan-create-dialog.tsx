"use client";

import * as React from "react";

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

import type { PlanCategoryOption, PlanEmployeeOption } from "./data";
import { PlanCreateForm } from "./plan-create-form";

type PlanCreateDialogProps = {
  categories?: PlanCategoryOption[];
  employees: PlanEmployeeOption[];
};

export function PlanCreateDialog({ categories, employees }: PlanCreateDialogProps) {
  const t = useTranslations("Dashboard.plans");
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus />
        {t("createPlan")}
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("createPlan")}</DialogTitle>
          <DialogDescription>{t("createDescription")}</DialogDescription>
        </DialogHeader>
        <PlanCreateForm categories={categories} employees={employees} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
