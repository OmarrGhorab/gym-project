import { PosCheckoutClient } from "./pos-checkout-client";
import type { PosMemberOption, PosProductOption } from "./data";

export async function PosCheckoutDialog({ members, products }: { members: PosMemberOption[]; products: PosProductOption[] }) {
  return <PosCheckoutClient members={members} products={products} />;
}
