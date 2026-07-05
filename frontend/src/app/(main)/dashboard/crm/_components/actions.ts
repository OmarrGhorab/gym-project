"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

export type MembershipActionResult =
  | {
      ok: true;
      message: string;
    }
  | {
      ok: false;
      message: string;
    };

export async function stopMembershipSubscription(id: number): Promise<MembershipActionResult> {
  return mutateSubscription(`/subscriptions/${id}/stop`, "Subscription stopped.");
}

export type UnfreezeMembershipSubscriptionInput = {
  resume_on?: string;
};

export async function unfreezeMembershipSubscription(
  id: number,
  input: UnfreezeMembershipSubscriptionInput = {},
): Promise<MembershipActionResult> {
  return mutateSubscription(`/subscriptions/${id}/unfreeze`, "Subscription unfrozen.", input);
}

export type RenewMembershipSubscriptionInput = {
  discount?: string;
  payment: {
    amount: string;
    method: "cash" | "card" | "bank_transfer";
  };
};

export async function renewMembershipSubscription(
  id: number,
  input: RenewMembershipSubscriptionInput,
): Promise<MembershipActionResult> {
  return mutateSubscription(`/subscriptions/${id}/renew`, "Subscription renewed.", input);
}

export type FreezeMembershipSubscriptionInput = {
  freeze_start: string;
  freeze_end: string;
  reason?: string;
};

export async function freezeMembershipSubscription(
  id: number,
  input: FreezeMembershipSubscriptionInput,
): Promise<MembershipActionResult> {
  return mutateSubscription(`/subscriptions/${id}/freeze`, "Subscription frozen.", input);
}

async function mutateSubscription(
  path: string,
  successMessage: string,
  body?: Record<string, unknown>,
): Promise<MembershipActionResult> {
  try {
    await serverApiFetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Action failed.",
    };
  }

  revalidatePath("/dashboard/crm");
  revalidatePath("/dashboard/default");

  return {
    ok: true,
    message: successMessage,
  };
}
