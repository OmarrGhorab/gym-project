import { getTranslations } from "next-intl/server";

import { getActionQueueData } from "./_components/data";
import { Tasks } from "./_components/tasks";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Page() {
  const t = await getTranslations("Dashboard.tasks");
  const tasks = await getActionQueueData();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-3xl tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground">{t("description")}</p>
      </div>
      <Tasks data={tasks} />
    </div>
  );
}
