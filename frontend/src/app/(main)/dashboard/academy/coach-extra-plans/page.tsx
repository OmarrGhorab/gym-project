import Link from "next/link";

import { ArrowLeft, Dumbbell, ReceiptText, UserCheck, Users } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormDatePicker } from "@/components/ui/form-controls";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";

import { CoachPlansTable } from "./_components/coach-plans-table";
import { getCoachExtraPlansReport } from "./_components/data";

type PageProps = {
  searchParams?: Promise<{
    from?: string;
    to?: string;
    coach_id?: string;
  }>;
};

export default async function CoachExtraPlansPage({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const defaultTo = today.toISOString().slice(0, 10);

  const from =
    resolvedParams?.from && /^\d{4}-\d{2}-\d{2}$/.test(resolvedParams.from) ? resolvedParams.from : defaultFrom;
  const to = resolvedParams?.to && /^\d{4}-\d{2}-\d{2}$/.test(resolvedParams.to) ? resolvedParams.to : defaultTo;
  const coachId = resolvedParams?.coach_id;

  const data = await getCoachExtraPlansReport(from, to, coachId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 px-2"
              nativeButton={false}
              render={<Link href="/dashboard/academy" />}
            >
              <ArrowLeft className="mr-1 size-4" />
              Back to Staff Academy
            </Button>
          </div>
          <h1 className="font-bold text-3xl tracking-tight">Coach Add-on Plans Report</h1>
          <p className="text-muted-foreground text-sm">
            Overview of members subscribed to extra add-on plans by coach, active subscriptions, and member attendance
            days this month.
          </p>
        </div>

        {/* Date filter form */}
        <form action="/dashboard/academy/coach-extra-plans" className="flex flex-wrap items-end gap-2" method="get">
          <div className="grid gap-1 text-muted-foreground text-xs">
            <Label htmlFor="from-date">From Date</Label>
            <FormDatePicker className="h-8 w-[8.5rem] min-w-0" defaultValue={from} id="from-date" name="from" />
          </div>
          <div className="grid gap-1 text-muted-foreground text-xs">
            <Label htmlFor="to-date">To Date</Label>
            <FormDatePicker className="h-8 w-[8.5rem] min-w-0" defaultValue={to} id="to-date" name="to" />
          </div>
          <button className={buttonVariants({ className: "h-8", size: "sm", variant: "secondary" })} type="submit">
            Filter Report
          </button>
        </form>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-sm">Active Coached Add-ons</CardTitle>
            <Dumbbell className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{data.kpis.total_coached_addons}</div>
            <p className="mt-1 text-muted-foreground text-xs">Extra plans assigned to coaches</p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-sm">Subscribed Members</CardTitle>
            <Users className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">{data.kpis.total_subscribed_members}</div>
            <p className="mt-1 text-muted-foreground text-xs">Distinct members in coached add-ons</p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-sm">Member Attended Days</CardTitle>
            <UserCheck className="size-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl text-emerald-600 dark:text-emerald-400">
              {data.kpis.total_attended_days} days
            </div>
            <p className="mt-1 text-muted-foreground text-xs">Total distinct check-in days this month</p>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="font-medium text-muted-foreground text-sm">Total Add-on Revenue</CardTitle>
            <ReceiptText className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="font-bold text-2xl">
              {formatCurrency(Number(data.kpis.total_addon_revenue), { currency: "EGP" })}
            </div>
            <p className="mt-1 text-muted-foreground text-xs">Coached extra plans revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <CoachPlansTable coaches={data.coaches} />
    </div>
  );
}
