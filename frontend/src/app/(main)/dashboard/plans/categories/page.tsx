import Link from "next/link";

import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { getPlanCategories } from "../_components/data";
import { PlanCategoriesManager } from "../_components/plan-categories-manager";

export default async function Page() {
  const t = await getTranslations("Dashboard.plans");
  const categories = await getPlanCategories();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">{t("categoriesTitle")}</h1>
          <p className="max-w-2xl text-muted-foreground text-sm">{t("categoriesDescription")}</p>
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard/plans" />} size="sm" variant="outline">
          <ArrowLeft className="size-4" />
          {t("backToPlans")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-normal">{t("categoriesTitle")}</CardTitle>
          <CardDescription>{t("categoriesCardDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PlanCategoriesManager categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
