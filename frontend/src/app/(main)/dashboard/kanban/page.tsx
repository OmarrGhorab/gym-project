import { getKanbanPageData } from "./_components/data";
import { Kanban } from "./_components/kanban";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Page() {
  const data = await getKanbanPageData();

  return (
    <div data-content-padding="false">
      <Kanban employees={data.employees} initialBoard={data.initialBoard} />
    </div>
  );
}
