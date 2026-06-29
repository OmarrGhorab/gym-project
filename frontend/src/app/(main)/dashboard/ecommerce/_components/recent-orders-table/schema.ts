export const orderFilters = ["All", "Paid", "Pending", "Completed", "Voided"] as const;

export type OrderFilter = (typeof orderFilters)[number];

export type OrderRow = {
  id: string;
  date: string | null;
  customer: string;
  seller: string;
  payment: "Paid" | "Pending";
  payment_method: string;
  total: string;
  items: string;
  status: string;
};
