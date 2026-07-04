import type { PosMemberOption, PosProductOption } from "./data";
import { PosCheckoutClient } from "./pos-checkout-client";

export async function PosCheckoutDialog({
  members,
  products,
}: {
  members: PosMemberOption[];
  products: PosProductOption[];
}) {
  return <PosCheckoutClient members={members} products={products} />;
}
