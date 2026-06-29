import { getInventoryLogisticsData } from "./_components/data";
import { Logistics } from "./_components/logistics";

export default async function Page() {
  const data = await getInventoryLogisticsData();

  return <Logistics data={data} />;
}
