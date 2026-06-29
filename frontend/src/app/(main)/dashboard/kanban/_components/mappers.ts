import { columnIds } from "./constants";
import type { ApiGymTask, ColumnId, Task, TaskInsight, TaskOwnerProfile, TaskPriority, TaskTeam } from "./types";

const systemOwner: TaskOwnerProfile = {
  name: "Gym Ops",
  tone: "[&_[data-slot=avatar-fallback]]:bg-zinc-100 [&_[data-slot=avatar-fallback]]:text-zinc-700 after:border-zinc-200 dark:[&_[data-slot=avatar-fallback]]:bg-zinc-500/15 dark:[&_[data-slot=avatar-fallback]]:text-zinc-300 dark:after:border-zinc-500/20",
};

export function toTask(task: ApiGymTask): Task {
  const insights: TaskInsight[] = [
    { label: "Comments", count: task.metrics?.comments ?? 0 },
    { label: "Documents", count: task.metrics?.documents ?? 0 },
    { label: "Attachments", count: task.metrics?.attachments ?? 0 },
  ];

  return {
    id: task.id,
    sourceId: task.source_id,
    source: task.source,
    title: task.title,
    description: task.description ?? "Gym operation task.",
    priority: toPriority(task.priority),
    dueDate: formatDueDate(task.due_date),
    dueDateValue: task.due_date,
    progress: task.progress,
    owner: toOwner(task.assigned_employee),
    team: toTeam(task.category),
    insights: insights.filter((insight) => insight.count > 0),
    href: task.href,
    editable: task.editable,
  };
}

export function toColumnId(value: string): ColumnId {
  if (columnIds.includes(value as ColumnId)) {
    return value as ColumnId;
  }

  return "planned";
}

function toOwner(employee: ApiGymTask["assigned_employee"]): TaskOwnerProfile {
  if (!employee) {
    return systemOwner;
  }

  return {
    name: employee.name,
    tone: "[&_[data-slot=avatar-fallback]]:bg-blue-100 [&_[data-slot=avatar-fallback]]:text-blue-700 after:border-blue-200 dark:[&_[data-slot=avatar-fallback]]:bg-blue-500/15 dark:[&_[data-slot=avatar-fallback]]:text-blue-300 dark:after:border-blue-500/20",
  };
}

function toPriority(value: string): TaskPriority {
  if (value === "high") {
    return "High";
  }

  if (value === "low") {
    return "Low";
  }

  return "Medium";
}

function toTeam(value: string): TaskTeam {
  const normalized = value.toLowerCase();

  if (normalized === "membership") return "Membership";
  if (normalized === "attendance") return "Attendance";
  if (normalized === "finance") return "Finance";
  if (normalized === "payroll") return "Payroll";
  if (normalized === "inventory") return "Inventory";
  if (normalized === "maintenance") return "Maintenance";

  return "Operations";
}

function formatDueDate(value: string | null) {
  if (!value) {
    return "No due date";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
  }).format(date);
}
