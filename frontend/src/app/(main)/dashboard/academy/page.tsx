import Link from "next/link";

import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { AssignmentStatus } from "./_components/assignment-status";
import { ClassSchedule } from "./_components/class-schedule";
import { getAcademyEmployees, getPayrollSettings, getStaffAcademyData } from "./_components/data";
import { KpiCards } from "./_components/kpi-cards";
import { PayDayManager } from "./_components/pay-day-manager";
import { PerformanceHighlights } from "./_components/performance-highlights";

type PageProps = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
  }>;
};

type AcademyPeriod = {
  from: string;
  to: string;
};

export default async function Page({ searchParams }: PageProps) {
  const t = await getTranslations("Dashboard.academy");
  const resolvedSearchParams = await searchParams;
  const period = getAcademyPeriod(resolvedSearchParams);
  const [data, employees, payrollSettings] = await Promise.all([
    getStaffAcademyData(period),
    getAcademyEmployees(),
    getPayrollSettings(),
  ]);
  const shortcutRanges = getShortcutRanges(period);
  const visibleKpis = data.kpis.filter((kpi) => kpi.label !== "Payroll Receipts");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>

        <div className="flex flex-col gap-2 lg:items-end">
          <div className="flex flex-wrap items-end justify-start gap-2 lg:justify-end">
            <form className="flex flex-wrap items-end gap-2" action="/dashboard/academy">
              <label className="grid gap-1 text-muted-foreground text-xs" htmlFor="academy-from-date">
                {t("fromDate")}
                <Input
                  className="h-8 w-[8.5rem] min-w-0"
                  id="academy-from-date"
                  name="from"
                  type="date"
                  defaultValue={period.from}
                />
              </label>
              <label className="grid gap-1 text-muted-foreground text-xs" htmlFor="academy-to-date">
                {t("toDate")}
                <Input
                  className="h-8 w-[8.5rem] min-w-0"
                  id="academy-to-date"
                  name="to"
                  type="date"
                  defaultValue={period.to}
                />
              </label>
              <Button className="h-8" size="sm" type="submit" variant="secondary">
                {t("applyFilter")}
              </Button>
            </form>
            <div className="flex flex-wrap items-center gap-1">
              {shortcutRanges.map((shortcut) => (
                <Button
                  className="h-8 px-2"
                  key={shortcut.key}
                  nativeButton={false}
                  render={<Link href={shortcut.href} />}
                  size="sm"
                  variant={shortcut.active ? "secondary" : "outline"}
                >
                  {t(shortcut.key)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <KpiCards kpis={visibleKpis} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <ClassSchedule shifts={data.shift_schedule} />
        </div>
        <div className="xl:col-span-7">
          <AssignmentStatus warnings={data.warning_status} />
        </div>
      </div>

      <PerformanceHighlights highlights={data.performance_highlights} />

      <PayDayManager employees={employees} payrollSettings={payrollSettings} />
    </div>
  );
}

function getAcademyPeriod(searchParams: Awaited<PageProps["searchParams"]> = {}): AcademyPeriod {
  const today = new Date();
  const from = isDateInput(searchParams?.from)
    ? searchParams.from
    : new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const to = isDateInput(searchParams?.to) ? searchParams.to : today.toISOString().slice(0, 10);

  return from <= to ? { from, to } : { from: to, to: from };
}

function isDateInput(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getShortcutRanges(currentPeriod: AcademyPeriod) {
  const today = new Date();
  const currentMonthStart = dateInput(new Date(today.getFullYear(), today.getMonth(), 1));
  const todayInput = dateInput(today);
  const shortcuts = [
    {
      key: "last24Hours",
      from: dateInput(addDays(today, -1)),
      to: todayInput,
    },
    {
      key: "last7Days",
      from: dateInput(addDays(today, -6)),
      to: todayInput,
    },
    {
      key: "thisMonth",
      from: currentMonthStart,
      to: todayInput,
    },
    {
      key: "lastMonth",
      from: dateInput(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
      to: dateInput(new Date(today.getFullYear(), today.getMonth(), 0)),
    },
  ] as const;

  return shortcuts.map((shortcut) => ({
    key: shortcut.key,
    href: `/dashboard/academy?from=${shortcut.from}&to=${shortcut.to}`,
    active: currentPeriod.from === shortcut.from && currentPeriod.to === shortcut.to,
  }));
}

function addDays(date: Date, days: number): Date {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function dateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}
