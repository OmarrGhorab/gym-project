"use client";

import * as React from "react";

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import {
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  Kanban as KanbanIcon,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  SquareArrowOutUpRight,
  Table2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupSeparator } from "@/components/ui/button-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { createGymTask, updateGymTaskStatus } from "./actions";
import { columnIds, columns } from "./constants";
import { KanbanColumn } from "./kanban-column";
import { toColumnId, toTask } from "./mappers";
import { TaskCard } from "./task-card";
import type { ApiGymTask, BoardState, ColumnId, Task } from "./types";
import { findColumnId, findTask } from "./utils";

interface KanbanProps {
  initialBoard: BoardState;
  employees: {
    id: number;
    name: string;
    role: string | null;
  }[];
}

export function Kanban({ employees, initialBoard }: KanbanProps) {
  const [board, setBoard] = React.useState<BoardState>(initialBoard);
  const [columnOrder, setColumnOrder] = React.useState<ColumnId[]>(columnIds);
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const [activeColumnId, setActiveColumnId] = React.useState<ColumnId | null>(null);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "editable" | "generated" | "high">("all");
  const [sort, setSort] = React.useState<"default" | "priority" | "due">("default");
  const [view, setView] = React.useState<"board" | "list" | "table">("board");
  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false);
  const boardBeforeDrag = React.useRef<BoardState | null>(null);
  const orderedColumns = columnOrder.flatMap((columnId) => columns.find((column) => column.id === columnId) ?? []);
  const visibleBoard = React.useMemo(() => filterBoard(board, query, filter, sort), [board, filter, query, sort]);
  const visibleRows = React.useMemo(() => flattenBoard(visibleBoard, columnOrder), [columnOrder, visibleBoard]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "column") return;

    boardBeforeDrag.current = board;
    const task = findTask(board, String(event.active.id));
    setActiveTask(task ?? null);
    setActiveColumnId(findColumnId(board, String(event.active.id)) ?? null);
  }

  function handleDragCancel() {
    if (boardBeforeDrag.current) {
      setBoard(boardBeforeDrag.current);
    }
    boardBeforeDrag.current = null;
    setActiveTask(null);
    setActiveColumnId(null);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    if (active.data.current?.type === "column") return;

    const activeId = String(active.id);
    const overId = String(over.id);

    setBoard((currentBoard) => {
      const activeColId = findColumnId(currentBoard, activeId);
      const overColId = findColumnId(currentBoard, overId);

      if (overColId) setActiveColumnId(overColId);

      if (!activeColId || !overColId || activeColId === overColId) return currentBoard;

      const activeItems = currentBoard[activeColId];
      const overItems = currentBoard[overColId];
      const activeIndex = activeItems.findIndex((task) => task.id === activeId);
      if (activeIndex === -1) return currentBoard;

      const overIndex = overItems.findIndex((task) => task.id === overId);
      const nextIndex = overIndex >= 0 ? overIndex : overItems.length;
      const activeItem = activeItems[activeIndex];

      return {
        ...currentBoard,
        [activeColId]: activeItems.filter((task) => task.id !== activeId),
        [overColId]: [...overItems.slice(0, nextIndex), activeItem, ...overItems.slice(nextIndex)],
      };
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const activeType = active.data.current?.type;
    const snapshot = boardBeforeDrag.current;
    boardBeforeDrag.current = null;
    setActiveTask(null);
    setActiveColumnId(null);

    if (activeType === "column") {
      if (!over) return;

      const activeColumnId = String(active.id) as ColumnId;
      const overColumnId = findColumnId(board, String(over.id));
      if (!overColumnId || activeColumnId === overColumnId) return;

      setColumnOrder((currentOrder) => {
        const activeIndex = currentOrder.indexOf(activeColumnId);
        const overIndex = currentOrder.indexOf(overColumnId);
        if (activeIndex === -1 || overIndex === -1) return currentOrder;
        return arrayMove(currentOrder, activeIndex, overIndex);
      });
      return;
    }

    if (!over) {
      if (snapshot) setBoard(snapshot);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    let movedTask: Task | undefined;
    let movedColumn: ColumnId | undefined;
    const previousColumn = snapshot ? findColumnId(snapshot, activeId) : findColumnId(board, activeId);

    setBoard((currentBoard) => {
      const activeColumnId = findColumnId(currentBoard, activeId);
      const overColumnId = findColumnId(currentBoard, overId);
      if (!activeColumnId || !overColumnId) return currentBoard;

      movedTask = findTask(currentBoard, activeId);
      movedColumn = overColumnId;

      if (activeColumnId !== overColumnId) {
        return currentBoard;
      }

      const columnTasks = currentBoard[activeColumnId];
      const activeIndex = columnTasks.findIndex((task) => task.id === activeId);
      const overIndex = columnTasks.findIndex((task) => task.id === overId);
      if (activeIndex === -1 || overIndex === -1 || activeIndex === overIndex) return currentBoard;

      return {
        ...currentBoard,
        [activeColumnId]: arrayMove(columnTasks, activeIndex, overIndex),
      };
    });

    if (movedTask && !movedTask.editable && movedColumn && previousColumn !== movedColumn) {
      toast.info("Backend alert cards are read-only. Open the source page to resolve them.");
      if (snapshot) setBoard(snapshot);
      return;
    }

    if (movedTask?.editable && movedTask.sourceId && movedColumn && previousColumn !== movedColumn) {
      const taskId = movedTask.sourceId;
      const nextColumn = movedColumn;

      React.startTransition(async () => {
        const result = await updateGymTaskStatus(taskId, nextColumn);

        if (!result.ok) {
          toast.error("Task status not saved", { description: result.message });
          if (snapshot) setBoard(snapshot);
          return;
        }

        toast.success(result.message);
      });
    }
  }

  return (
    <div className="flex h-[calc(100dvh-var(--dashboard-header-height))] min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-3 border-b px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
        <Tabs value={view} onValueChange={(value) => setView(value as typeof view)} className="min-w-0">
          <TabsList className="w-full *:data-[slot=tabs-trigger]:flex-1 sm:w-fit sm:*:data-[slot=tabs-trigger]:flex-none">
            <TabsTrigger value="board" className="gap-2">
              <KanbanIcon />
              Board
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <List />
              List
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-2">
              <Table2 />
              Table
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center 2xl:justify-end">
          <InputGroup className="min-w-0 sm:w-64 2xl:w-48">
            <InputGroupInput
              type="search"
              placeholder="Search tasks"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
          </InputGroup>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className="w-full sm:w-auto" />}>
              <SlidersHorizontal data-icon="inline-start" />
              {getFilterLabel(filter)}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setFilter("all")}>All tasks</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("generated")}>Backend alerts</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("editable")}>Manual tasks</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("high")}>High priority</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className="w-full sm:w-auto" />}>
              <ArrowUpDown data-icon="inline-start" />
              {getSortLabel(sort)}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setSort("default")}>Default</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort("priority")}>Priority</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort("due")}>Due date</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ButtonGroup className="w-full sm:w-fit">
            <Button className="flex-1 sm:flex-none" onClick={() => setTaskDialogOpen(true)}>
              <Plus data-icon="inline-start" />
              Add task
            </Button>
            <ButtonGroupSeparator />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button aria-label="Open add task menu" />}>
                <ChevronDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setTaskDialogOpen(true)}>Create manual task</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("generated")}>Show backend alerts</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("high")}>Show urgent tasks</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        </div>
      </div>

      {view === "board" ? (
        <DndContext
          id="kanban-board"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <div className="scrollbar-thin min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden bg-muted/25 px-4 pt-4 pb-0 [scrollbar-color:var(--border)_transparent] lg:px-5 lg:pt-5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-1">
            <div className="inline-grid h-full min-w-full grid-cols-[repeat(5,minmax(20rem,1fr))] gap-4">
              <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                {orderedColumns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    tasks={visibleBoard[column.id]}
                    onAddTask={() => setTaskDialogOpen(true)}
                  />
                ))}
              </SortableContext>
            </div>
          </div>
          <DragOverlay dropAnimation={null}>
            {activeTask ? <TaskCard task={activeTask} columnId={activeColumnId ?? undefined} isOverlay /> : null}
          </DragOverlay>
        </DndContext>
      ) : null}
      {view === "list" ? <TaskListView rows={visibleRows} /> : null}
      {view === "table" ? <TaskTableView rows={visibleRows} /> : null}
      <CreateTaskDialog
        employees={employees}
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        onTaskCreated={(task) => {
          const columnId = toColumnId(task.status);
          setBoard((currentBoard) => ({
            ...currentBoard,
            [columnId]: [toTask(task), ...currentBoard[columnId]],
          }));
        }}
      />
    </div>
  );
}

function TaskListView({ rows }: { rows: TaskRow[] }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-muted/25 p-4 lg:p-5">
      <div className="mx-auto grid max-w-5xl gap-3">
        {rows.length > 0 ? (
          rows.map(({ column, task }) => (
            <div key={task.id} className="rounded-xl border bg-card p-4 text-card-foreground">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-medium text-sm">{task.title}</h3>
                    <PriorityBadge priority={task.priority} />
                    <Badge variant="secondary" className="rounded-md border-transparent">
                      {column.title}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">{task.description}</p>
                </div>
                {task.href ? (
                  <Button render={<a href={task.href} />} size="sm" variant="outline">
                    Open
                    <SquareArrowOutUpRight />
                  </Button>
                ) : null}
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                <InfoItem label="Owner" value={task.owner.name} />
                <InfoItem label="Due date" value={task.dueDate} />
                <InfoItem label="Team" value={task.team} />
                <InfoItem label="Source" value={task.editable ? "Manual" : "Backend alert"} />
              </div>
            </div>
          ))
        ) : (
          <EmptyTasks />
        )}
      </div>
    </div>
  );
}

function TaskTableView({ rows }: { rows: TaskRow[] }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-muted/25 p-4 lg:p-5">
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Due date</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length > 0 ? (
              rows.map(({ column, task }) => (
                <TableRow key={task.id}>
                  <TableCell className="max-w-md whitespace-normal">
                    <div className="font-medium">{task.title}</div>
                    <div className="line-clamp-1 text-muted-foreground text-xs">{task.description}</div>
                  </TableCell>
                  <TableCell>{column.title}</TableCell>
                  <TableCell>
                    <PriorityBadge priority={task.priority} />
                  </TableCell>
                  <TableCell>{task.owner.name}</TableCell>
                  <TableCell>{task.dueDate}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="rounded-md border-transparent">
                      {task.team}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {task.href ? (
                      <Button render={<a href={task.href} />} size="sm" variant="ghost">
                        Open
                      </Button>
                    ) : (
                      <span className="text-muted-foreground text-xs">Manual</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="h-32 text-center text-muted-foreground" colSpan={7}>
                  No tasks match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function EmptyTasks() {
  return (
    <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground text-sm">
      No tasks match the current filters.
    </div>
  );
}

function PriorityBadge({ priority }: { priority: Task["priority"] }) {
  return (
    <Badge
      variant={priority === "High" ? "destructive" : "secondary"}
      className={cn(
        "rounded-md border-transparent",
        priority === "Medium" && "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
        priority === "Low" && "bg-slate-500/10 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
      )}
    >
      {priority}
    </Badge>
  );
}

function CreateTaskDialog({
  employees,
  open,
  onOpenChange,
  onTaskCreated,
}: {
  employees: KanbanProps["employees"];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: (task: ApiGymTask) => void;
}) {
  const [pending, startTransition] = React.useTransition();
  const [selectedEmployeeId, setSelectedEmployeeId] = React.useState("none");
  const [dueDate, setDueDate] = React.useState<Date | undefined>();
  const selectedEmployee = employees.find((employee) => String(employee.id) === selectedEmployeeId);
  const dueDateValue = dueDate ? formatDateValue(dueDate) : "";

  function submit(formData: FormData) {
    formData.set("assigned_employee_id", selectedEmployeeId);
    formData.set("due_date", dueDateValue);

    startTransition(async () => {
      const result = await createGymTask(formData);

      if (result.ok) {
        if (result.task) {
          onTaskCreated(result.task);
        }
        toast.success(result.message);
        onOpenChange(false);
        setSelectedEmployeeId("none");
        setDueDate(undefined);
        return;
      }

      toast.error("Task not created", { description: result.message });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add gym task</DialogTitle>
          <DialogDescription>
            Create a manual operational task for staff, managers, or admin follow-up.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="task-title">Title</Label>
              <Input id="task-title" name="title" required placeholder="Check treadmill maintenance" />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea id="task-description" name="description" placeholder="What needs to happen?" />
            </div>
            <TaskSelect name="status" label="Status" options={statusOptions} />
            <TaskSelect name="priority" label="Priority" options={priorityOptions} />
            <TaskSelect name="category" label="Category" options={categoryOptions} />
            <div className="grid gap-2">
              <Label>Due date</Label>
              <input name="due_date" type="hidden" value={dueDateValue} />
              <Popover>
                <PopoverTrigger
                  render={<Button type="button" variant="outline" className="justify-start text-left font-normal" />}
                >
                  <CalendarDays />
                  {dueDate ? formatDisplayDate(dueDate) : "Pick due date"}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-2">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} fixedWeeks />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="task-employee">Assigned employee</Label>
              <Select
                value={selectedEmployeeId}
                onValueChange={(value) => value && setSelectedEmployeeId(value)}
                name="assigned_employee_id"
              >
                <SelectTrigger id="task-employee" className="w-full">
                  <span className="truncate">{selectedEmployee ? selectedEmployee.name : "No employee"}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">No employee</SelectItem>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={String(employee.id)}>
                        {employee.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Creating..." : "Create task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskSelect({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: readonly { label: string; value: string }[];
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={`task-${name}`}>{label}</Label>
      <Select defaultValue={options[0]?.value} name={name}>
        <SelectTrigger id={`task-${name}`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

function filterBoard(
  board: BoardState,
  query: string,
  filter: "all" | "editable" | "generated" | "high",
  sort: "default" | "priority" | "due",
): BoardState {
  const normalizedQuery = query.trim().toLowerCase();
  const next = {} as BoardState;

  for (const columnId of columnIds) {
    let tasks = board[columnId].filter((task) => {
      const matchesQuery =
        !normalizedQuery ||
        task.title.toLowerCase().includes(normalizedQuery) ||
        task.description.toLowerCase().includes(normalizedQuery) ||
        task.team.toLowerCase().includes(normalizedQuery);
      const matchesFilter =
        filter === "all" ||
        (filter === "editable" && task.editable) ||
        (filter === "generated" && !task.editable) ||
        (filter === "high" && task.priority === "High");

      return matchesQuery && matchesFilter;
    });

    if (sort === "priority") {
      tasks = [...tasks].sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority));
    }

    if (sort === "due") {
      tasks = [...tasks].sort((a, b) => dueRank(a.dueDateValue) - dueRank(b.dueDateValue));
    }

    next[columnId] = tasks;
  }

  return next;
}

type TaskRow = {
  column: (typeof columns)[number];
  task: Task;
};

function flattenBoard(board: BoardState, orderedColumnIds: ColumnId[]): TaskRow[] {
  return orderedColumnIds.flatMap((columnId) => {
    const column = columns.find((item) => item.id === columnId);

    if (!column) {
      return [];
    }

    return board[columnId].map((task) => ({ column, task }));
  });
}

function getFilterLabel(filter: "all" | "editable" | "generated" | "high") {
  if (filter === "editable") return "Manual";
  if (filter === "generated") return "Backend";
  if (filter === "high") return "Urgent";

  return "Filter";
}

function getSortLabel(sort: "default" | "priority" | "due") {
  if (sort === "priority") return "Priority";
  if (sort === "due") return "Due date";

  return "Sort";
}

function priorityRank(priority: Task["priority"]) {
  return { High: 0, Medium: 1, Low: 2 }[priority];
}

function dueRank(value: string | null) {
  if (!value) {
    return Number.MAX_SAFE_INTEGER;
  }

  return new Date(`${value}T00:00:00`).getTime();
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

const statusOptions = [
  { label: "Planned", value: "planned" },
  { label: "Ideas", value: "ideas" },
  { label: "In Progress", value: "doing" },
  { label: "Review", value: "review" },
] as const;

const priorityOptions = [
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Low", value: "low" },
] as const;

const categoryOptions = [
  { label: "Operations", value: "operations" },
  { label: "Membership", value: "membership" },
  { label: "Attendance", value: "attendance" },
  { label: "Finance", value: "finance" },
  { label: "Payroll", value: "payroll" },
  { label: "Inventory", value: "inventory" },
  { label: "Maintenance", value: "maintenance" },
] as const;
