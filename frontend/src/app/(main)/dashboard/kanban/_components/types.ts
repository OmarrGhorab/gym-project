export type ColumnId = "ideas" | "planned" | "doing" | "review" | "done";

export type Column = {
  id: ColumnId;
  title: string;
};

export type TaskTeam = "Membership" | "Attendance" | "Finance" | "Payroll" | "Inventory" | "Maintenance" | "Operations";

export type TaskPriority = "High" | "Medium" | "Low";

export type TaskInsightLabel = "Attachments" | "Comments" | "Documents";

export type TaskInsight = {
  label: TaskInsightLabel;
  count: number;
};

export type TaskOwnerProfile = {
  name: string;
  tone: string;
};

export type Task = {
  id: string;
  sourceId: number | null;
  source: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
  dueDateValue: string | null;
  progress: number;
  owner: TaskOwnerProfile;
  team: TaskTeam;
  insights: TaskInsight[];
  href: string | null;
  editable: boolean;
};

export type BoardState = Record<ColumnId, Task[]>;

export type ApiGymTask = {
  id: string;
  source_id: number | null;
  source: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  progress: number;
  due_date: string | null;
  editable: boolean;
  href: string | null;
  assigned_employee: {
    id: number;
    name: string;
    role: string | null;
  } | null;
  metrics?: {
    comments?: number;
    documents?: number;
    attachments?: number;
  };
};
