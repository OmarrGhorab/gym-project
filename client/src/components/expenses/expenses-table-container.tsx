"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ExpenseFormDialog } from "@/components/expenses/expense-form-dialog";
import { ExpensesTable } from "@/components/expenses/expenses-table";
import type { Expense } from "@/lib/api/dashboard";

export function ExpensesTableContainer({ expenses }: { expenses: Expense[] }) {
  const t = useTranslations("ExpensesPage");
  const [dialogMode, setDialogMode] = React.useState<"add" | "edit">("add");
  const [selectedExpense, setSelectedExpense] = React.useState<Expense | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  function openAddDialog() {
    setDialogMode("add");
    setSelectedExpense(null);
    setIsDialogOpen(true);
  }

  function openEditDialog(expense: Expense) {
    setDialogMode("edit");
    setSelectedExpense(expense);
    setIsDialogOpen(true);
  }

  return (
    <>
      <div className="flex items-center justify-end border-b px-4 py-3">
        <Button type="button" size="sm" onClick={openAddDialog}>
          <Plus className="size-4" />
          {t("addButton")}
        </Button>
      </div>
      <ExpensesTable expenses={expenses} onEdit={openEditDialog} />
      <ExpenseFormDialog
        mode={dialogMode}
        expense={selectedExpense}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
