import { PackageCheck, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/utils";

import { createPlan, deletePlan, togglePlan } from "./_components/actions";
import { getPlansPageData } from "./_components/data";

export default async function Page() {
  const t = await getTranslations("Dashboard.plans");
  const plans = await getPlansPageData();
  const active = plans.filter((plan) => plan.is_active).length;
  const sellable = plans.filter((plan) => plan.is_sellable).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Summary label={t("plans")} value={plans.length.toString()} />
        <Summary label={t("active")} value={active.toString()} />
        <Summary label={t("sellableToday")} value={sellable.toString()} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-normal">
              <Plus className="size-4" />
              {t("createPlan")}
            </CardTitle>
            <CardDescription>{t("createDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createPlan} className="grid gap-4">
              <Field label={t("name")} name="name" />
              <Field label={t("type")} name="type" defaultValue="monthly" />
              <Field label={t("price")} name="price" type="number" step="0.01" />
              <Field label={t("durationDays")} name="duration_days" type="number" defaultValue="30" />
              <Field label={t("sessionsCount")} name="sessions_count" type="number" />
              <Field label={t("maxFreezeDays")} name="max_freeze_days" type="number" defaultValue="0" />
              <div className="space-y-2">
                <Label htmlFor="description">{t("descriptionField")}</Label>
                <Textarea id="description" name="description" />
              </div>
              <Button type="submit">
                <PackageCheck />
                {t("createPlan")}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="xl:col-span-8">
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
                    <TableCell>{formatCurrency(Number(plan.price), { currency: "EGP", noDecimals: true })}</TableCell>
                    <TableCell>{t("days", { count: plan.duration_days })}</TableCell>
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
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
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

function Field({
  defaultValue = "",
  label,
  name,
  step,
  type = "text",
}: {
  defaultValue?: string;
  label: string;
  name: string;
  step?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} step={step} defaultValue={defaultValue} />
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
