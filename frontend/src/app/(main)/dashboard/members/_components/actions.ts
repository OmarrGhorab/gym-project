"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";
import type { MemberPaymentHistory, MemberPaymentRow, MemberRow, MemberVisitRow } from "./data";

export async function fetchMemberDetails(
  memberId: number,
): Promise<{ history: MemberPaymentHistory | null; payments: MemberPaymentRow[]; visits: MemberVisitRow[] }> {
  const [historyResult, paymentsResult, visitsResult] = await Promise.all([
    serverApiFetch<MemberPaymentHistory | null>(`/members/${memberId}/payment-history`).catch(() => ({
      data: null as MemberPaymentHistory | null,
    })),
    serverApiFetch<MemberPaymentRow[] | PaginatedData<MemberPaymentRow>>(
      `/members/${memberId}/payments?per_page=10`,
    ).catch(() => ({ data: [] as MemberPaymentRow[] })),
    serverApiFetch<MemberVisitRow[] | PaginatedData<MemberVisitRow>>(
      `/member-visits?member_id=${memberId}&sort=-check_in_at&per_page=5`,
    ).catch(() => ({ data: [] as MemberVisitRow[] })),
  ]);

  return {
    history: historyResult.data,
    payments: unwrapList(paymentsResult.data as MemberPaymentRow[] | PaginatedData<MemberPaymentRow>),
    visits: unwrapList(visitsResult.data as MemberVisitRow[] | PaginatedData<MemberVisitRow>),
  };
}

export async function createMember(input: FormData): Promise<void> {
  const payload = {
    birth_date: nullableString(input.get("birth_date")),
    email: nullableString(input.get("email")),
    gender: nullableString(input.get("gender")),
    join_date: nullableString(input.get("join_date")),
    name: String(input.get("name") || ""),
    national_id: nullableString(input.get("national_id")),
    notes: nullableString(input.get("notes")),
    phone: String(input.get("phone") || ""),
    status: String(input.get("status") || "active"),
  };

  await serverApiFetch("/members", {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/crm");
}

export async function updateMember(input: FormData): Promise<void> {
  const memberId = Number(input.get("id"));
  const payload = {
    birth_date: nullableString(input.get("birth_date")),
    email: nullableString(input.get("email")),
    gender: nullableString(input.get("gender")),
    join_date: nullableString(input.get("join_date")),
    name: String(input.get("name") || ""),
    national_id: nullableString(input.get("national_id")),
    notes: nullableString(input.get("notes")),
    phone: String(input.get("phone") || ""),
    status: String(input.get("status") || "active"),
  };

  await serverApiFetch(`/members/${memberId}`, {
    body: JSON.stringify(payload),
    headers: {
      "Content-Type": "application/json",
    },
    method: "PUT",
  });

  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/crm");
}

export async function deactivateMember(input: FormData): Promise<void> {
  await serverApiFetch(`/members/${Number(input.get("id"))}`, {
    method: "DELETE",
  });

  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/crm");
}

export async function uploadMemberPhoto(input: FormData): Promise<void> {
  const memberId = Number(input.get("member_id"));
  const payload = new FormData();
  const photo = input.get("photo");

  if (!Number.isInteger(memberId) || memberId <= 0) {
    throw new Error("Invalid member id.");
  }

  if (!(photo instanceof File) || photo.size <= 0) {
    throw new Error("Choose a member photo before uploading.");
  }

  payload.set("photo", photo);

  const result = await serverApiFetch<MemberRow>(`/members/${memberId}/photo`, {
    body: payload,
    method: "POST",
  });

  if (!result.data.has_photo) {
    throw new Error("The backend saved the request, but no member photo was attached.");
  }

  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/crm");
}

function nullableString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();

  return normalized.length > 0 ? normalized : null;
}
