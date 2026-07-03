"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

import { type PaginatedData, unwrapList } from "../../_lib/api";
import type { MemberPaymentHistory, MemberPaymentRow, MemberRow, MemberVisitRow } from "./data";

const optionalTextInput = (max?: number) =>
  z.preprocess((value) => {
    const normalized = String(value ?? "").trim();

    return normalized.length > 0 ? normalized : null;
  }, (max ? z.string().max(max) : z.string()).nullable());

const optionalDateInput = z.preprocess((value) => {
  const normalized = String(value ?? "").trim();

  return normalized.length > 0 ? normalized : null;
}, z.string().date().nullable());

const memberInputSchema = z.object({
  birth_date: optionalDateInput,
  email: z.preprocess((value) => {
    const normalized = String(value ?? "").trim();

    return normalized.length > 0 ? normalized : null;
  }, z.email("Enter a valid email address.").max(150).nullable()),
  gender: z.preprocess((value) => {
    const normalized = String(value ?? "").trim();

    return normalized.length > 0 ? normalized : null;
  }, z.enum(["male", "female"], { error: "Gender must be male or female." }).nullable()),
  join_date: optionalDateInput,
  name: z.string().trim().min(1, "Member name is required.").max(150, "Member name is too long."),
  national_id: z.preprocess(
    (value) => {
      const normalized = String(value ?? "").trim();

      return normalized.length > 0 ? normalized : null;
    },
    z
      .string()
      .regex(/^[23][0-9]{13}$/, "National ID must be a valid Egyptian national ID.")
      .nullable(),
  ),
  notes: optionalTextInput(),
  phone: z
    .string()
    .trim()
    .regex(/^(?:\+20|0020|0)?1[0125][0-9]{8}$/, "Phone must be a valid Egyptian mobile number."),
  status: z.enum(["active", "inactive"], { error: "Status must be active or inactive." }),
});

const memberIdSchema = z.coerce.number().int().min(1, "Member is required.");

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
  const payload = parseMemberInput(input);

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
  const memberId = memberIdSchema.parse(input.get("id"));
  const payload = parseMemberInput(input);

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
  const memberId = memberIdSchema.parse(input.get("id"));

  await serverApiFetch(`/members/${memberId}`, {
    method: "DELETE",
  });

  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/crm");
}

export async function uploadMemberPhoto(input: FormData): Promise<void> {
  const memberId = memberIdSchema.parse(input.get("member_id"));
  const payload = new FormData();
  const photo = input.get("photo");

  if (!(photo instanceof File) || photo.size <= 0) {
    throw new Error("Choose a member photo before uploading.");
  }

  if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) {
    throw new Error("Photo must be a JPG, PNG, or WebP image.");
  }

  if (photo.size > 5 * 1024 * 1024) {
    throw new Error("Photo must be 5 MB or smaller.");
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

function parseMemberInput(input: FormData) {
  return memberInputSchema.parse({
    birth_date: input.get("birth_date"),
    email: input.get("email"),
    gender: input.get("gender"),
    join_date: input.get("join_date"),
    name: input.get("name"),
    national_id: input.get("national_id"),
    notes: input.get("notes"),
    phone: input.get("phone"),
    status: input.get("status") || "active",
  });
}
