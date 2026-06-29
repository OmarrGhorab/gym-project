import { getActionQueueData } from "./_components/data";
import { Tasks } from "./_components/tasks";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Page() {
  const tasks = await getActionQueueData();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-3xl tracking-tight">Action Queue</h2>
        <p className="text-muted-foreground">Review gym tasks, backend alerts, comments, and progress in one table.</p>
      </div>
      <Tasks data={tasks} />
    </div>
  );
}
