import { ArrowDown, ArrowRight, ArrowUp, CheckCircle, Circle, Eye, Timer } from "lucide-react";

import type { Task as KanbanTask } from "../../kanban/_components/types";

export type Task = KanbanTask & {
  status: string;
  sourceLabel: string;
};

export function sourceLabel(source: string) {
  if (source === "manual") return "Manual";
  if (source === "attendance") return "Attendance";
  if (source === "subscription") return "Renewal";
  if (source === "payroll") return "Payroll";
  if (source === "product") return "Inventory";
  if (source === "due") return "Dues";

  return "Backend";
}

export const statuses = [
  {
    value: "ideas",
    label: "Ideas",
    icon: Eye,
  },
  {
    value: "planned",
    label: "Planned",
    icon: Circle,
  },
  {
    value: "doing",
    label: "In Progress",
    icon: Timer,
  },
  {
    value: "review",
    label: "Review",
    icon: Eye,
  },
  {
    value: "done",
    label: "Done",
    icon: CheckCircle,
  },
];

export const priorities = [
  {
    label: "Low",
    value: "Low",
    icon: ArrowDown,
  },
  {
    label: "Medium",
    value: "Medium",
    icon: ArrowRight,
  },
  {
    label: "High",
    value: "High",
    icon: ArrowUp,
  },
];
