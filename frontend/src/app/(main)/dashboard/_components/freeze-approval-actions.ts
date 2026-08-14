"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

const idSchema = z.coerce.number().int().positive();

export type FreezeApprovalActionResult = {
  ok: boolean;
  message: string;
};

export async function decideFreezeApproval(
  subscriptionId: number,
  freezeRequestId: number,
  decision: "approve" | "dismiss",
): Promise<FreezeApprovalActionResult> {
  const parsedSubscriptionId = idSchema.safeParse(subscriptionId);
  const parsedFreezeRequestId = idSchema.safeParse(freezeRequestId);

  if (!parsedSubscriptionId.success || !parsedFreezeRequestId.success) {
    return { ok: false, message: "Invalid freeze approval request." };
  }

  try {
    const result = await serverApiFetch(
      `/subscriptions/${parsedSubscriptionId.data}/freezes/${parsedFreezeRequestId.data}/${decision}`,
      { method: "POST" },
    );

    revalidateFreezeViews();

    return {
      ok: true,
      message: result.message ?? (decision === "approve" ? "Freeze request approved." : "Freeze request dismissed."),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not decide the freeze request.",
    };
  }
}

function revalidateFreezeViews() {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/default");
  revalidatePath("/dashboard/crm");
  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/mail");
}
