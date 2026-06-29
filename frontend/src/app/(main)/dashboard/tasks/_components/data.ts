import { serverApiFetch } from "@/lib/api/server";

import { toTask } from "../../kanban/_components/mappers";
import type { ApiGymTask } from "../../kanban/_components/types";
import { sourceLabel, type Task } from "./types";

export async function getActionQueueData(): Promise<Task[]> {
  try {
    const result = await serverApiFetch<ApiGymTask[]>("/gym-tasks");

    return result.data.map((task) => ({
      ...toTask(task),
      status: task.status,
      sourceLabel: sourceLabel(task.source),
    }));
  } catch {
    return [];
  }
}
