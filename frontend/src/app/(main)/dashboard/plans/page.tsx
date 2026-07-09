import { Pencil } from "lucide-react";
import { getTranslations } from "next-intl/server";

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

export default async function Page() {
  const t = await getTranslations("Dashboard.plans");
  const { employees, plans } = await getPlansPageData();
  const active = plans.filter((plan) => plan.is_active).length;
  const sellable = plans.filter((plan) => plan.is_sellable).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <PlanCreateDialog employees={employees} />
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
          <CardContent>
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
                    <TableCell>{plan.type}</TableCell>
                    <TableCell>{t(`categories.${plan.category}`)}</TableCell>
                    <TableCell>{formatCurrency(Number(plan.price), { currency: "EGP", noDecimals: true })}</TableCell>
                    <TableCell>
                      {plan.duration_months
                        ? t("months", { count: plan.duration_months })
                        : t("days", { count: plan.duration_days })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={plan.is_active ? "secondary" : "outline"}>
                        {plan.is_active ? t("active") : t("inactive")}
                      </Badge>
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
                            <PlanCreateForm employees={employees} mode="edit" plan={plan} />
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
