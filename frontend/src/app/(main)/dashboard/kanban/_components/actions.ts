"use server";

import { revalidatePath } from "next/cache";

import { serverApiFetch } from "@/lib/api/server";

import type { ApiGymTask, ApiGymTaskComment, ApiGymTaskDetail, ColumnId } from "./types";

export type KanbanActionResult =
  | {
      ok: true;
      message: string;
      task?: ApiGymTask;
    }
  | {
      ok: false;
      message: string;
    };

export async function createGymTask(input: FormData): Promise<KanbanActionResult> {
  const assignedEmployeeId = String(input.get("assigned_employee_id") ?? "");
  const payload = {
    title: String(input.get("title") ?? ""),
    description: String(input.get("description") ?? ""),
    status: String(input.get("status") ?? "planned"),
    priority: String(input.get("priority") ?? "medium"),
    category: String(input.get("category") ?? "operations"),
    progress: Number(input.get("progress") ?? 0),
    due_date: String(input.get("due_date") ?? "") || null,
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
  try {
    const response = await serverApiFetch<ApiGymTaskComment>(`/gym-tasks/${sourceId}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body }),
    });

    revalidatePath("/dashboard/kanban");

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
