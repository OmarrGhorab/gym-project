"use client";

import * as React from "react";

import { Lock, Pencil, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { createPlanCategoryAction, deletePlanCategoryAction, updatePlanCategoryAction } from "./actions";
import type { PlanCategoryOption } from "./data";
import { PlanTypeField } from "./plan-type-field";
import { type PlanType, planTypeMessageKey } from "./plan-types";

type Draft = {
  description: string;
  id: number | null;
  isActive: boolean;
  name: string;
  planType: PlanType;
};

const EMPTY_DRAFT: Draft = {
  description: "",
  id: null,
  isActive: true,
  name: "",
  planType: "membership",
};

export function PlanCategoriesManager({ categories }: { categories: PlanCategoryOption[] }) {
  const t = useTranslations("Dashboard.plans");
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSave() {
    if (draft === null) {
      return;
    }

    if (!draft.name.trim()) {
      toast.error(t("categoryNameRequired"));
      return;
    }

    setPending(true);
    const result =
      draft.id === null
        ? await createPlanCategoryAction(draft.name.trim(), draft.planType, draft.description.trim() || undefined)
        : await updatePlanCategoryAction(draft.id, {
            description: draft.description.trim() || undefined,
            isActive: draft.isActive,
            name: draft.name.trim(),
            planType: draft.planType,
          });
    setPending(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(draft.id === null ? t("categoryCreated", { name: draft.name.trim() }) : t("categoryUpdated"));
    setDraft(null);
  }

  async function handleRetire(category: PlanCategoryOption) {
    setPending(true);
    const result = await deletePlanCategoryAction(category.id);
    setPending(false);

    if (result.ok) {
      toast.success(t("categoryRetired", { name: category.name }));
    } else {
      toast.error(result.error);
    }
  }

  async function handleRestore(category: PlanCategoryOption) {
    setPending(true);
    const result = await updatePlanCategoryAction(category.id, {
      description: category.description ?? undefined,
      isActive: true,
      name: category.name,
      planType: category.plan_type,
    });
    setPending(false);

    if (result.ok) {
      toast.success(t("categoryRestored", { name: category.name }));
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDraft(EMPTY_DRAFT)} size="sm">
          <Plus className="size-4" />
          {t("addCategory")}
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("categoryName")}</TableHead>
            <TableHead>{t("categoryKey")}</TableHead>
            <TableHead>{t("categoryTypeLabel")}</TableHead>
            <TableHead>{t("plans")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead className="text-end">{t("actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category.id}>
              <TableCell>
                <div className="flex items-center gap-2 font-medium">
                  {category.name}
                  {category.is_system ? <Lock className="size-3 text-muted-foreground" /> : null}
                </div>
                {category.description ? (
                  <div className="line-clamp-1 text-muted-foreground text-xs">{category.description}</div>
                ) : null}
              </TableCell>
              <TableCell className="font-mono text-muted-foreground text-xs">{category.slug}</TableCell>
              <TableCell>
                <Badge variant="outline">{t(planTypeMessageKey(category.plan_type))}</Badge>
              </TableCell>
              <TableCell className="tabular-nums">{category.plans_count ?? 0}</TableCell>
              <TableCell>
                <Badge variant={category.is_active ? "secondary" : "outline"}>
                  {category.is_active ? t("active") : t("inactive")}
                </Badge>
              </TableCell>
              <TableCell className="text-end">
                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() =>
                      setDraft({
                        description: category.description ?? "",
                        id: category.id,
                        isActive: category.is_active,
                        name: category.name,
                        planType: category.plan_type,
                      })
                    }
                    size="sm"
                    variant="outline"
                  >
                    <Pencil />
                    {t("edit")}
                  </Button>
                  {category.is_active ? (
                    <Button
                      // Built-in categories drive subscription pricing and the coach
                      // report, so the API refuses to retire them.
                      disabled={pending || category.is_system}
                      onClick={() => handleRetire(category)}
                      size="sm"
                      variant="destructive"
                    >
                      {t("retire")}
                    </Button>
                  ) : (
                    <Button disabled={pending} onClick={() => handleRestore(category)} size="sm" variant="outline">
                      {t("restore")}
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {categories.length === 0 ? (
            <TableRow>
              <TableCell className="py-8 text-center text-muted-foreground" colSpan={6}>
                {t("noCategories")}
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <Dialog onOpenChange={(open) => !open && setDraft(null)} open={draft !== null}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id === null ? t("addCategoryTitle") : t("editCategoryTitle")}</DialogTitle>
            <DialogDescription>
              {draft?.id === null ? t("addCategoryDescription") : t("editCategoryDescription")}
            </DialogDescription>
          </DialogHeader>
          {draft ? (
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <Label htmlFor="category_name">{t("categoryName")}</Label>
                <Input
                  id="category_name"
                  onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                  placeholder={t("categoryNamePlaceholder")}
                  value={draft.name}
                />
                {draft.id !== null ? <p className="text-muted-foreground text-xs">{t("categoryKeyLocked")}</p> : null}
              </div>
              <PlanTypeField
                id="manage_cat_type"
                onChange={(planType) => setDraft({ ...draft, planType })}
                value={draft.planType}
              />
              <div className="space-y-1">
                <Label htmlFor="category_description">{t("categoryDescriptionOptional")}</Label>
                <Input
                  id="category_description"
                  onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                  placeholder={t("categoryDescriptionPlaceholder")}
                  value={draft.description}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button onClick={() => setDraft(null)} type="button" variant="outline">
              {t("cancel")}
            </Button>
            <Button disabled={pending} onClick={handleSave} type="button">
              {pending ? t("saving") : t("saveCategory")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
