import { Calendar } from "./_components/calendar";
import { getCalendarPageData } from "./_components/data";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function Page() {
  const data = await getCalendarPageData();

  return <Calendar employees={data.employees} events={data.events} />;
}
