import { getTranslations } from "next-intl/server";

import { CalendarPanel } from "./_components/calendar-panel";
import { getOperationsSummaryData } from "./_components/data";
import { FocusCard } from "./_components/focus-card";
import { ProjectsSection } from "./_components/projects-section";
import { QuickActions } from "./_components/quick-actions";
import { QuoteCard } from "./_components/quote-card";
import { RecentNotesCard } from "./_components/recent-notes-card";
import { SummaryCards } from "./_components/summary-cards";
import { TasksSection } from "./_components/tasks-section";
import { WeeklySummaryCard } from "./_components/weekly-summary-card";

export default async function Page() {
  const t = await getTranslations("Dashboard.productivity");
  const data = await getOperationsSummaryData();

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <section className="lg:col-span-9">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl text-foreground leading-none tracking-tight">{t("title")}</h1>
            <p className="text-lg text-muted-foreground leading-none">{t("description")}</p>
          </div>
          <SummaryCards data={data} />
          <TasksSection tasks={data.tasks} />
          <ProjectsSection workflows={data.workflows} />
          <QuickActions actions={data.quick_actions} />
          <QuoteCard focus={data.summary.focus_description} />
        </div>
      </section>

      <section className="flex flex-col gap-6 lg:col-span-3">
        <CalendarPanel events={data.calendar_events} />
        <FocusCard summary={data.summary} />
        <RecentNotesCard activity={data.activity} />
        <WeeklySummaryCard week={data.week} />
      </section>
    </div>
  );
}
