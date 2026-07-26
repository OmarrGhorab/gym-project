import { canAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";

import { getMembershipDashboardData } from "./_components/data";
import { KpiCards } from "./_components/kpi-cards";
import { OpportunitiesSection } from "./_components/opportunities-section";
import { PipelineActivity } from "./_components/pipeline-activity";
import { TaskReminders } from "./_components/task-reminders";

export default async function Page() {
  const [user, data] = await Promise.all([getCurrentUser(), getMembershipDashboardData()]);
  const canViewMoney = user
    ? canAccess(user, ["reports.view", "payroll.view", "expenses.view", "export.reports"])
    : false;

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <KpiCards summary={data.summary} canViewMoney={canViewMoney} />
      {canViewMoney ? <PipelineActivity data={data.chart} summary={data.summary} /> : null}
      <TaskReminders followUps={data.followUps} renewalGoal={data.renewalGoal} />
      <OpportunitiesSection rows={data.pipelineRows} reminderDays={data.reminderDays} canViewMoney={canViewMoney} />
    </div>
  );
}
