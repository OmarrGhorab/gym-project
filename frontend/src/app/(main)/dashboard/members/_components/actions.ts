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

export type MemberFormState = {
  errors: Partial<Record<string, string[]>>;
  message?: string;
  ok: boolean;
  values: Record<string, string>;
};

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

export async function createMember(_state: MemberFormState, input: FormData): Promise<MemberFormState> {
  const values = getFormValues(input);
  const parsed = memberInputSchema.safeParse({
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

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  try {
    await serverApiFetch("/members", {
      body: JSON.stringify(parsed.data),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create member.",
      errors: {},
      values,
    };
  }

  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/crm");

  return {
    ok: true,
    message: "Member created.",
    errors: {},
    values: {},
  };
}

export async function updateMember(_state: MemberFormState, input: FormData): Promise<MemberFormState> {
  const memberId = memberIdSchema.safeParse(input.get("id"));
  const values = getFormValues(input);

  if (!memberId.success) {
    return {
      ok: false,
      message: "Invalid member.",
      errors: {},
      values,
    };
  }

  const parsed = memberInputSchema.safeParse({
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

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  try {
    await serverApiFetch(`/members/${memberId.data}`, {
      body: JSON.stringify(parsed.data),
      headers: {
        "Content-Type": "application/json",
      },
      method: "PUT",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not update member.",
      errors: {},
      values,
    };
  }

  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/crm");

  return {
    ok: true,
    message: "Member updated.",
    errors: {},
    values: {},
  };
}

export async function createMemberSubscription(_state: MemberFormState, input: FormData): Promise<MemberFormState> {
  const memberId = memberIdSchema.safeParse(input.get("member_id"));
  const values = getFormValues(input);

  if (!memberId.success) {
    return {
      ok: false,
      message: "Member is required.",
      errors: {},
      values,
    };
  }

  const parsed = subscriptionInputSchema.safeParse({
    discount: input.get("discount"),
    end_date: input.get("end_date"),
    payment_amount: input.get("payment_amount"),
    payment_method: input.get("payment_method") || "cash",
    plan_id: input.get("plan_id"),
    start_date: input.get("start_date"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  try {
    await serverApiFetch("/subscriptions", {
      body: JSON.stringify({
        member_id: memberId.data,
        plan_id: parsed.data.plan_id,
        start_date: parsed.data.start_date,
        end_date: parsed.data.end_date,
        discount: parsed.data.discount ?? "0",
        payment: {
          amount: parsed.data.payment_amount,
          method: parsed.data.payment_method,
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create subscription.",
      errors: {},
      values,
    };
  }

  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/crm");

  return {
    ok: true,
    message: "Subscription added.",
    errors: {},
    values: {},
  };
}

export async function changeMemberPlan(_state: MemberFormState, input: FormData): Promise<MemberFormState> {
  const subscriptionId = z.coerce
    .number()
    .int()
    .min(1, "Subscription is required.")
    .safeParse(input.get("subscription_id"));
  const values = getFormValues(input);

  if (!subscriptionId.success) {
    return {
      ok: false,
      message: "Subscription is required.",
      errors: {},
      values,
    };
  }

  const parsed = subscriptionChangeSchema.safeParse({
    discount: input.get("discount"),
    payment_amount: input.get("payment_amount"),
    payment_method: input.get("payment_method") || "cash",
    plan_id: input.get("plan_id"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Please review the highlighted fields.",
      errors: parsed.error.flatten().fieldErrors,
      values,
    };
  }

  try {
    await serverApiFetch(`/subscriptions/${subscriptionId.data}/upgrade`, {
      body: JSON.stringify({
        plan_id: parsed.data.plan_id,
        discount: parsed.data.discount ?? "0",
        payment: {
          amount: parsed.data.payment_amount,
          method: parsed.data.payment_method,
        },
      }),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not change plan.",
      errors: {},
      values,
    };
  }

  revalidatePath("/dashboard/members");
  revalidatePath("/dashboard/crm");

  return {
    ok: true,
    message: "Plan changed.",
    errors: {},
    values: {},
  };
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

const subscriptionInputSchema = z.object({
  discount: optionalTextInput(),
  end_date: optionalDateInput,
  payment_amount: z.string().trim().min(1, "Payment amount is required."),
  payment_method: z.enum(["cash", "card", "bank_transfer"]),
  plan_id: z.coerce.number().int().min(1, "Plan is required."),
  start_date: z.string().date("Start date is required."),
});

const subscriptionChangeSchema = z.object({
  discount: optionalTextInput(),
  payment_amount: z.string().trim().min(1, "Payment amount is required."),
  payment_method: z.enum(["cash", "card", "bank_transfer"]),
  plan_id: z.coerce.number().int().min(1, "Plan is required."),
});

function getFormValues(input: FormData): Record<string, string> {
  return Object.fromEntries(
    Array.from(input.entries()).map(([key, value]) => [key, typeof value === "string" ? value : ""]),
  );
}
