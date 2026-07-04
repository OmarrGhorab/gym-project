import { getInventoryLogisticsData } from "./_components/data";
import { Logistics } from "./_components/logistics";
import { emptyInventoryLogisticsData } from "./_components/shipment-data";

export default async function Page() {
  const rawData = await getInventoryLogisticsData();
  const data = { ...emptyInventoryLogisticsData, ...rawData };

  return <Logistics data={data} />;
}
