"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { serverApiFetch } from "@/lib/api/server";

import type { ApiGymTask, ApiGymTaskComment, ApiGymTaskDetail, ColumnId } from "./types";

export type KanbanActionResult =
  | {
      ok: true;
      message: string;
      task?: ApiGymTask;
      errors?: Partial<Record<string, string[]>>;
    }
  | {
      ok: false;
      message: string;
      errors?: Partial<Record<string, string[]>>;
    };

const gymTaskSchema = z.object({
  assigned_employee_id: z.union([z.coerce.number().int().positive(), z.literal("none"), z.literal("")]).optional(),
  category: z.enum(["operations", "membership", "attendance", "finance", "payroll", "inventory", "maintenance"], {
    error: "Choose a valid category.",
  }),
  description: z.string().trim().max(1000, "Description is too long.").optional(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid due date.")
    .or(z.literal(""))
    .optional(),
  priority: z.enum(["low", "medium", "high"], { error: "Choose a valid priority." }),
  progress: z.coerce.number().min(0).max(100),
  status: z.enum(["planned", "ideas", "doing", "review"], { error: "Choose a valid status." }),
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(120, "Title is too long."),
});

const taskCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment is required.").max(1000, "Comment is too long."),
});

export async function createGymTask(input: FormData): Promise<KanbanActionResult> {
  const assignedEmployeeId = String(input.get("assigned_employee_id") ?? "");
  const parsed = gymTaskSchema.safeParse({
    assigned_employee_id: assignedEmployeeId,
    category: String(input.get("category") ?? "operations"),
    description: String(input.get("description") ?? ""),
    due_date: String(input.get("due_date") ?? ""),
    priority: String(input.get("priority") ?? "medium"),
    progress: Number(input.get("progress") ?? 0),
    status: String(input.get("status") ?? "planned"),
    title: String(input.get("title") ?? ""),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: "Please fix the highlighted task fields.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const payload = {
    title: parsed.data.title,
    description: parsed.data.description ?? "",
    status: parsed.data.status,
    priority: parsed.data.priority,
    category: parsed.data.category,
    progress: parsed.data.progress,
    due_date: parsed.data.due_date || null,
    assigned_employee_id: assignedEmployeeId && assignedEmployeeId !== "none" ? Number(assignedEmployeeId) : null,
  };

  let createdTask: ApiGymTask | undefined;

  try {
    const response = await serverApiFetch<ApiGymTask>("/gym-tasks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    createdTask = response.data;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not create task.",
    };
  }

  revalidatePath("/dashboard/kanban");
  revalidatePath("/dashboard/tasks");

  return {
    ok: true,
    message: "Gym task created.",
    task: createdTask,
  };
}

export async function updateGymTaskStatus(sourceId: number, status: ColumnId): Promise<KanbanActionResult> {
  try {
    await serverApiFetch(`/gym-tasks/${sourceId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status, progress: progressForStatus(status) }),
    });
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not update task status.",
    };
  }

  revalidatePath("/dashboard/kanban");
  revalidatePath("/dashboard/tasks");

  return {
    ok: true,
    message: "Task status updated.",
  };
}

export async function updateGymTaskProgress(sourceId: number, progress: number): Promise<KanbanActionResult> {
  try {
    const response = await serverApiFetch<ApiGymTask>(`/gym-tasks/${sourceId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ progress }),
    });

    revalidatePath("/dashboard/kanban");
    revalidatePath("/dashboard/tasks");

    return {
      ok: true,
      message: "Task progress updated.",
      task: response.data,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not update task progress.",
    };
  }
}

export async function getGymTaskDetail(sourceId: number): Promise<
  | {
      ok: true;
      task: ApiGymTaskDetail;
    }
  | {
      ok: false;
      message: string;
    }
> {
  try {
    const response = await serverApiFetch<ApiGymTaskDetail>(`/gym-tasks/${sourceId}`);

    return {
      ok: true,
      task: response.data,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not load task.",
    };
  }
}

export async function createGymTaskComment(
  sourceId: number,
  body: string,
): Promise<
  | {
      ok: true;
      comment: ApiGymTaskComment;
      message: string;
    }
  | {
      ok: false;
      message: string;
    }
> {
  const parsed = taskCommentSchema.safeParse({ body });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.flatten().fieldErrors.body?.[0] ?? "Comment is not valid.",
    };
  }

  try {
    const response = await serverApiFetch<ApiGymTaskComment>(`/gym-tasks/${sourceId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: parsed.data.body }),
    });

    revalidatePath("/dashboard/kanban");
    revalidatePath("/dashboard/tasks");

    return {
      ok: true,
      comment: response.data,
      message: "Comment added.",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not add comment.",
    };
  }
}

function progressForStatus(status: ColumnId) {
  if (status === "ideas") return 0;
  if (status === "planned") return 20;
  if (status === "doing") return 55;
  if (status === "review") return 80;
  return 100;
}
