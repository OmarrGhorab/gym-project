import type { Column, TaskTeam } from "./types";

export const columns = [
  { id: "ideas", title: "Ideas" },
  { id: "planned", title: "Planned" },
  { id: "doing", title: "In Progress" },
  { id: "review", title: "Review" },
  { id: "done", title: "Done" },
] as const satisfies readonly Column[];

export const columnIds = columns.map((column) => column.id);

export const tagTones: Record<TaskTeam, string> = {
  Attendance: "bg-red-500/10 text-red-700 dark:text-red-300",
  Finance: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  Inventory: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Maintenance: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  Membership: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  Operations: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  Payroll: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};
