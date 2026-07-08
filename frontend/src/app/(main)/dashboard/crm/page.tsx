import { getMembershipDashboardData } from "./_components/data";
import { KpiCards } from "./_components/kpi-cards";
import { OpportunitiesSection } from "./_components/opportunities-section";
import { PipelineActivity } from "./_components/pipeline-activity";
import { TaskReminders } from "./_components/task-reminders";

export default async function Page() {
  const data = await getMembershipDashboardData();

  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <KpiCards summary={data.summary} />
      <PipelineActivity data={data.chart} summary={data.summary} />
      <TaskReminders followUps={data.followUps} renewalGoal={data.renewalGoal} />
      <OpportunitiesSection rows={data.pipelineRows} reminderDays={data.reminderDays} />
    </div>
  );
}
