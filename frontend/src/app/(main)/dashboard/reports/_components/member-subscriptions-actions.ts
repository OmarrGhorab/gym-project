"use server";

import { serverApiFetch } from "@/lib/api/server";

export async function getMemberSubscriptionHistory(memberId: number) {
  const response = await serverApiFetch<Record<string, unknown>>(`/reports/member-subscriptions?member_id=${memberId}`);

  return response.data;
}

export async function getSubscriptionDetail(subscriptionId: number) {
  const response = await serverApiFetch<Record<string, unknown>>(
    `/reports/member-subscriptions?subscription_id=${subscriptionId}`,
  );

  return response.data;
}
