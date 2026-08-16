import { Suspense } from "react";

import Link from "next/link";

import { Pencil, Tags } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Money } from "@/components/money/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

import { deletePlan, togglePlan } from "./_components/actions";
import { getPlansPageData } from "./_components/data";
import { PlanCreateDialog } from "./_components/plan-create-dialog";
import { PlanCreateForm } from "./_components/plan-create-form";
import { PlansToolbar } from "./_components/plans-toolbar";

type PageProps = {
  searchParams: Promise<{
    search?: string;
    status?: string;
    type?: string;
    created_from?: string;
    created_to?: string;
  }>;
};

export default async function Page({ searchParams }: PageProps) {
  const t = await getTranslations("Dashboard.plans");
  const resolvedSearchParams = await searchParams;
  const query = {
    search: resolvedSearchParams.search?.trim() || undefined,
    status: resolvedSearchParams.status || undefined,
    type: resolvedSearchParams.type || undefined,
    created_from: resolvedSearchParams.created_from || undefined,
    created_to: resolvedSearchParams.created_to || undefined,
  };
  const { categories, employees, plans } = await getPlansPageData(query);
  const planTypeLabels: Record<string, string> = {
    extra_service: t("planTypes.extraService"),
    fitness_studio: t("planTypes.fitnessStudio"),
    membership: t("planTypes.membership"),
    membership_extra_service: t("planTypes.membershipExtraService"),
    offer: t("planTypes.offer"),
    offer_package: t("planTypes.offerPackage"),
  };
  const active = plans.filter((plan) => plan.is_active).length;
  const sellable = plans.filter((plan) => plan.is_sellable).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button nativeButton={false} render={<Link href="/dashboard/plans/categories" />} variant="outline">
            <Tags />
            {t("manageCategories")}
          </Button>
          <PlanCreateDialog categories={categories} employees={employees} plans={plans} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Summary label={t("plans")} value={plans.length.toString()} />
        <Summary label={t("active")} value={active.toString()} />
        <Summary label={t("sellableToday")} value={sellable.toString()} />
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-normal">{t("catalog")}</CardTitle>
            <CardDescription>{t("catalogDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Suspense>
              <PlansToolbar />
            </Suspense>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("type")}</TableHead>
                  <TableHead>{t("category")}</TableHead>
                  <TableHead>{t("price")}</TableHead>
                  <TableHead>{t("duration")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="text-end">{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell>
                      <div className="font-medium">{plan.name}</div>
                      <div className="line-clamp-1 text-muted-foreground text-xs">{plan.description}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={plan.type === "fitness_studio" ? "default" : "outline"}
                        className={plan.type === "fitness_studio" ? "bg-purple-600 text-white" : ""}
                      >
                        {planTypeLabels[plan.type] ?? plan.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{plan.category}</TableCell>
                    <TableCell>
                      <Money domain="plans">
                        {formatCurrency(Number(plan.price), { currency: "EGP", noDecimals: true })}
                      </Money>
                    </TableCell>
                    <TableCell>
                      {plan.duration_months
                        ? t("months", { count: plan.duration_months })
                        : t("days", { count: plan.duration_days })}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant={plan.is_active ? "secondary" : "outline"}>
                          {plan.is_active ? t("active") : t("inactive")}
                        </Badge>
                        {(() => {
                          const daysUntilStart = daysUntilDate(plan.valid_from);

                          if (plan.is_active && daysUntilStart !== null && daysUntilStart > 0) {
                            return (
                              <span className="text-amber-600 text-xs dark:text-amber-400">
                                {t("startsInDays", { count: daysUntilStart })}
                              </span>
                            );
                          }

                          if (plan.is_active && !plan.is_sellable && plan.valid_to) {
                            const daysSinceEnd = daysUntilDate(plan.valid_to);

                            if (daysSinceEnd !== null && daysSinceEnd < 0) {
                              return <span className="text-muted-foreground text-xs">{t("offerEnded")}</span>;
                            }
                          }

                          return null;
                        })()}
                      </div>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-2">
                        <form action={togglePlan}>
                          <input type="hidden" name="id" value={plan.id} />
                          <Button type="submit" size="sm" variant="outline">
                            {plan.is_active ? t("disable") : t("enable")}
                          </Button>
                        </form>
                        <Dialog>
                          <DialogTrigger render={<Button size="sm" variant="outline" />}>
                            <Pencil />
                            {t("edit")}
                          </DialogTrigger>
                          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-3xl">
                            <DialogHeader>
                              <DialogTitle>{t("editPlan")}</DialogTitle>
                              <DialogDescription>{t("editDescription")}</DialogDescription>
                            </DialogHeader>
                            <PlanCreateForm
                              availablePlans={plans}
                              categories={categories}
                              employees={employees}
                              mode="edit"
                              plan={plan}
                            />
                          </DialogContent>
                        </Dialog>
                        <form action={deletePlan}>
                          <input type="hidden" name="id" value={plan.id} />
                          <Button type="submit" size="sm" variant="destructive">
                            {t("delete")}
                          </Button>
                        </form>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {plans.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      {t("noPlans")}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Calendar-day delta from today to a YYYY-MM-DD date. Positive = future. */
function daysUntilDate(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parts = value.slice(0, 10).split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  const [year, month, day] = parts;
  const target = Date.UTC(year, month - 1, day);
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  return Math.round((target - today) / 86_400_000);
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent>
        <p className="text-muted-foreground text-sm">{label}</p>
        <p className="font-medium text-2xl tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
