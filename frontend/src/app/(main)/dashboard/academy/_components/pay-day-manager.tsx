"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import type { AcademyActionResult } from "./actions";
import { updateEmployeePayDay } from "./actions";
import type { AcademyEmployeePayDay } from "./data";

export function PayDayManager({ employees }: { employees: AcademyEmployeePayDay[] }) {
  const t = useTranslations("Dashboard.academy");

  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle className="text-sm">{t("payDayManager")}</CardTitle>
        <CardDescription>{t("payDayManagerDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div className="rounded-lg border border-dashed bg-muted/20 px-3 py-2 text-muted-foreground text-xs">
          {t("payDayEndOfMonthNotice")}
        </div>
        {employees.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
            {t("payDayNoEmployees")}
          </div>
        ) : (
          employees.map((employee) => <PayDayRow employee={employee} key={employee.id} />)
        )}
      </CardContent>
    </Card>
  );
}

function PayDayRow({ employee }: { employee: AcademyEmployeePayDay }) {
  const t = useTranslations("Dashboard.academy");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<AcademyActionResult["errors"]>({});
  const [value, setValue] = React.useState(() => (employee.pay_day ? String(employee.pay_day) : ""));

  React.useEffect(() => {
    setValue(employee.pay_day ? String(employee.pay_day) : "");
  }, [employee.pay_day]);

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await updateEmployeePayDay(formData);
      setErrors(result.errors ?? {});

      if (result.ok) {
        toast.success(result.message);
        router.refresh();
        return;
      }

      toast.error(result.message);
    });
  }

  return (
    <form
      className="grid gap-3 rounded-xl border border-border/60 bg-background/40 p-3 shadow-sm transition-colors hover:bg-muted/20 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      action={submit}
    >
      <input type="hidden" name="id" value={employee.id} />
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted font-semibold text-muted-foreground text-xs uppercase">
          {employee.name.slice(0, 2)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate font-medium text-sm">{employee.name}</div>
            <Badge variant="outline" className="rounded-full px-2 py-0 text-[11px]">
              {employee.pay_day ? t("payDayValue", { day: employee.pay_day }) : t("payDayEndOfMonth")}
            </Badge>
          </div>
          <div className="text-muted-foreground text-xs capitalize">{employee.role}</div>
          <FieldError errors={errors?.pay_day} />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2 sm:justify-end">
        <div className="grid gap-1">
          <label className="text-muted-foreground text-xs" htmlFor={`pay-day-${employee.id}`}>
            {t("payDay")}
          </label>
          <Input
            id={`pay-day-${employee.id}`}
            name="pay_day"
            type="number"
            min={1}
            max={31}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={t("payDayEndOfMonth")}
            className="h-9 w-28"
            aria-invalid={Boolean(errors?.pay_day?.[0])}
          />
        </div>
        <Button type="submit" size="sm" className="h-9" disabled={pending}>
          {t("save")}
        </Button>
      </div>
    </form>
  );
}
