"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { API_BASE_URL } from "@/app/api/auth/_lib";
import type { AppLocale } from "@/i18n/routing";
import type { CommissionBackfillResult } from "@/lib/api/dashboard";
import { getAuthToken } from "@/lib/session";

export type CommissionBackfillData = {
  from: string;
  to: string;
  dry_run?: boolean;
};

export async function backfillCommissions(
  data: CommissionBackfillData,
  locale: AppLocale
): Promise<CommissionBackfillResult> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error("Unauthorized");
  }

  const response = await fetch(`${API_BASE_URL}/commissions/backfill`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    const details =
      (payload.error as { details?: Record<string, string[]> } | undefined)?.details ?? undefined;
    const errorMessage =
      ((payload.error as { message?: string })?.message) ??
      (payload.message as string) ??
      response.statusText;

    if (details && Object.keys(details).length > 0) {
      throw new Error(JSON.stringify({ message: errorMessage, details }));
    }

    throw new Error(errorMessage);
  }

  revalidatePath(`/${locale}/commissions`);
  revalidatePath(`/${locale}/payroll`);
  revalidateTag("commissions", "max");
  revalidateTag("payroll", "max");

  return payload.data as CommissionBackfillResult;
}
