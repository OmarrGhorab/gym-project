import { ClipboardCheck, QrCode, ReceiptText } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

import { AssignmentStatus } from "./_components/assignment-status";
import { ClassSchedule } from "./_components/class-schedule";
import { getStaffAcademyData } from "./_components/data";
import { EmployeePerformanceTable } from "./_components/employee-performance-table";
import { KpiCards } from "./_components/kpi-cards";
import { PerformanceHighlights } from "./_components/performance-highlights";
import { StaffManagement } from "./_components/staff-management";
import { UpcomingEvents } from "./_components/upcoming-events";

export default async function Page() {
  const t = await getTranslations("Dashboard.academy");
  const data = await getStaffAcademyData();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:w-fit">
          <Button size="sm">
            <QrCode />
            {t("staffScan")}
          </Button>
          <Button size="sm" variant="outline">
            <ClipboardCheck />
            {t("reviewWarnings")}
          </Button>
          <Button size="sm" variant="outline">
            <ReceiptText />
            {t("payrollReceipts")}
          </Button>
        </div>
      </div>

      <KpiCards kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <ClassSchedule shifts={data.shift_schedule} />
        </div>
        <div className="xl:col-span-7">
          <AssignmentStatus warnings={data.warning_status} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <PerformanceHighlights highlights={data.performance_highlights} />
        </div>
        <div className="xl:col-span-4">
          <UpcomingEvents events={data.upcoming_events} />
        </div>
      </div>

      <EmployeePerformanceTable rows={data.employeeRows} />

      <StaffManagement
        employees={data.employeeRows.map((row) => row.employee)}
        shifts={data.shifts}
        users={data.users}
        roles={data.roles}
      />
    </div>
  );
}
