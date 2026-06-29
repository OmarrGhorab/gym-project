import { serverApiFetch } from "@/lib/api/server";

import { toColumnId, toTask } from "./mappers";
import type { ApiGymTask, BoardState } from "./types";

type ApiEmployee = {
  id: number;
  name: string;
  role: string | null;
};

type EmployeesResponse = {
  data?: ApiEmployee[];
};

export async function getKanbanPageData() {
  const [tasksResult, employeesResult] = await Promise.all([
    safeFetch<ApiGymTask[]>("/gym-tasks"),
    safeFetch<EmployeesResponse | ApiEmployee[]>("/employees?per_page=100"),
  ]);

  const employeesPayload = employeesResult.data;
  const employees = Array.isArray(employeesPayload) ? employeesPayload : (employeesPayload.data ?? []);

  return {
    initialBoard: toBoard(tasksResult.data),
    employees,
  };
}

function toBoard(tasks: ApiGymTask[]): BoardState {
  const board = emptyBoard();

  for (const task of tasks) {
    const columnId = toColumnId(task.status);
    board[columnId].push(toTask(task));
  }

  return board;
}

export function emptyBoard(): BoardState {
  return {
    doing: [],
    done: [],
    ideas: [],
    planned: [],
    review: [],
  };
}

async function safeFetch<T>(path: string): Promise<{ data: T }> {
  try {
    return await serverApiFetch<T>(path);
  } catch {
    return { data: [] as T };
  }
}
