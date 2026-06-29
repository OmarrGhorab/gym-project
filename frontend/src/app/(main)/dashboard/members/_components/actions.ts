"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

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

  if (photo instanceof File && photo.size > 0) {
    payload.set("photo", photo);
  }

  await serverApiFetch(`/members/${memberId}/photo`, {
    body: payload,
    method: "POST",
  });

  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/crm");
}

function nullableString(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();

  return normalized.length > 0 ? normalized : null;
}
