import { canAccess } from "@/lib/authorization";
import { getCurrentUser } from "@/lib/session";

import { getInventoryLogisticsData } from "./_components/data";
import { Logistics } from "./_components/logistics";
import { emptyInventoryLogisticsData } from "./_components/shipment-data";

export default async function Page() {
  const user = await getCurrentUser();
  const rawData = await getInventoryLogisticsData();
  const data = { ...emptyInventoryLogisticsData, ...rawData };
  const productPermissions = {
    canAdjustInventory: user ? canAccess(user, "inventory.adjust") : false,
    canCreateProduct: user ? canAccess(user, "products.create") : false,
    canDeleteProduct: user ? canAccess(user, "products.delete") : false,
    canUpdateProduct: user ? canAccess(user, "products.update") : false,
  };

  return <Logistics data={data} productPermissions={productPermissions} />;
}
