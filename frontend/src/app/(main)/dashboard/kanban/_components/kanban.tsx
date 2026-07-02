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
  ExternalLink,
  Kanban as KanbanIcon,
  List,
  Plus,
  Search,
  SlidersHorizontal,
  SquareArrowOutUpRight,
  Table2,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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

import {
  createGymTask,
  createGymTaskComment,
  getGymTaskDetail,
  updateGymTaskProgress,
  updateGymTaskStatus,
} from "./actions";
import { columnIds, columns } from "./constants";
import { KanbanColumn } from "./kanban-column";
import { toColumnId, toTask } from "./mappers";
import { TaskCard } from "./task-card";
import type { ApiGymTask, ApiGymTaskComment, BoardState, ColumnId, Task } from "./types";
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
  const t = useTranslations("Dashboard.tasks");
  const locale = useLocale();
  const [board, setBoard] = React.useState<BoardState>(initialBoard);
  const [columnOrder, setColumnOrder] = React.useState<ColumnId[]>(columnIds);
  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const [activeColumnId, setActiveColumnId] = React.useState<ColumnId | null>(null);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "editable" | "generated" | "high">("all");
  const [sort, setSort] = React.useState<"default" | "priority" | "due">("default");
  const [view, setView] = React.useState<"board" | "list" | "table">("board");
  const [taskDialogOpen, setTaskDialogOpen] = React.useState(false);
  const [detailTask, setDetailTask] = React.useState<Task | null>(null);
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

  function updateTaskInBoard(task: ApiGymTask) {
    const nextTask = toTask(task);

    setBoard((currentBoard) => {
      const nextBoard: BoardState = {
        doing: currentBoard.doing.filter((item) => item.id !== nextTask.id),
        done: currentBoard.done.filter((item) => item.id !== nextTask.id),
        ideas: currentBoard.ideas.filter((item) => item.id !== nextTask.id),
        planned: currentBoard.planned.filter((item) => item.id !== nextTask.id),
        review: currentBoard.review.filter((item) => item.id !== nextTask.id),
      };
      const columnId = toColumnId(task.status);

      return {
        ...nextBoard,
        [columnId]: [nextTask, ...nextBoard[columnId]],
      };
    });

    setDetailTask(nextTask);
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
      toast.info(t("readonlyAlert"));
      if (snapshot) setBoard(snapshot);
      return;
    }

    if (movedTask?.editable && movedTask.sourceId && movedColumn && previousColumn !== movedColumn) {
      const taskId = movedTask.sourceId;
      const nextColumn = movedColumn;

      React.startTransition(async () => {
        const result = await updateGymTaskStatus(taskId, nextColumn);

        if (!result.ok) {
          toast.error(t("statusNotSaved"), { description: result.message });
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
              {t("board")}
            </TabsTrigger>
            <TabsTrigger value="list" className="gap-2">
              <List />
              {t("list")}
            </TabsTrigger>
            <TabsTrigger value="table" className="gap-2">
              <Table2 />
              {t("table")}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center 2xl:justify-end">
          <InputGroup className="min-w-0 sm:w-64 2xl:w-48">
            <InputGroupInput
              type="search"
              placeholder={t("searchTasks")}
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
              {getFilterLabel(filter, t)}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setFilter("all")}>{t("allTasks")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("generated")}>{t("backendAlerts")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("editable")}>{t("manualTasks")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter("high")}>{t("highPriority")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" className="w-full sm:w-auto" />}>
              <ArrowUpDown data-icon="inline-start" />
              {getSortLabel(sort, t)}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={() => setSort("default")}>{t("default")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort("priority")}>{t("priority")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSort("due")}>{t("dueDate")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ButtonGroup className="w-full sm:w-fit">
            <Button className="flex-1 sm:flex-none" onClick={() => setTaskDialogOpen(true)}>
              <Plus data-icon="inline-start" />
              {t("addTask")}
            </Button>
            <ButtonGroupSeparator />
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button aria-label={t("openAddTaskMenu")} />}>
                <ChevronDown />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => setTaskDialogOpen(true)}>{t("createManualTask")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("generated")}>{t("showBackendAlerts")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter("high")}>{t("showUrgentTasks")}</DropdownMenuItem>
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
                    columnTitle={t(`statuses.${column.id}`)}
                    tasks={visibleBoard[column.id]}
                    taskCountLabel={t("taskCount", { count: visibleBoard[column.id].length })}
                    onAddTask={() => setTaskDialogOpen(true)}
                    onOpenTask={setDetailTask}
                    addTaskLabel={t("addTaskToColumn", { column: t(`statuses.${column.id}`) })}
                    dragLabel={t("dragColumn", { column: t(`statuses.${column.id}`) })}
                  />
                ))}
              </SortableContext>
            </div>
          </div>
          <DragOverlay dropAnimation={null}>
            {activeTask ? (
              <TaskCard task={activeTask} columnId={activeColumnId ?? undefined} isOverlay onOpenTask={setDetailTask} />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : null}
      {view === "list" ? <TaskListView rows={visibleRows} onOpenTask={setDetailTask} /> : null}
      {view === "table" ? <TaskTableView rows={visibleRows} onOpenTask={setDetailTask} /> : null}
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
        locale={locale}
      />
      <TaskDetailDialog
        task={detailTask}
        open={detailTask !== null}
        onOpenChange={(open) => !open && setDetailTask(null)}
        onTaskUpdated={updateTaskInBoard}
        locale={locale}
      />
    </div>
  );
}

function TaskListView({ onOpenTask, rows }: { rows: TaskRow[]; onOpenTask: (task: Task) => void }) {
  const t = useTranslations("Dashboard.tasks");

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
                      {t(`statuses.${column.id}`)}
                    </Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-muted-foreground text-sm">{task.description}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => onOpenTask(task)}>
                  {t("open")}
                  <SquareArrowOutUpRight />
                </Button>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                <InfoItem label={t("owner")} value={task.owner.name} />
                <InfoItem label={t("dueDate")} value={task.dueDate} />
                <InfoItem label={t("team")} value={t(`teams.${task.team}`)} />
                <InfoItem label={t("source")} value={task.editable ? t("sources.manual") : t("sources.backendAlert")} />
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

function TaskTableView({ onOpenTask, rows }: { rows: TaskRow[]; onOpenTask: (task: Task) => void }) {
  const t = useTranslations("Dashboard.tasks");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-muted/25 p-4 lg:p-5">
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("task")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("priority")}</TableHead>
              <TableHead>{t("owner")}</TableHead>
              <TableHead>{t("dueDate")}</TableHead>
              <TableHead>{t("team")}</TableHead>
              <TableHead className="text-end">{t("action")}</TableHead>
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
                  <TableCell>{t(`statuses.${column.id}`)}</TableCell>
                  <TableCell>
                    <PriorityBadge priority={task.priority} />
                  </TableCell>
                  <TableCell>{task.owner.name}</TableCell>
                  <TableCell>{task.dueDate}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="rounded-md border-transparent">
                      {t(`teams.${task.team}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-end">
                    <Button size="sm" variant="ghost" onClick={() => onOpenTask(task)}>
                      {t("open")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell className="h-32 text-center text-muted-foreground" colSpan={7}>
                  {t("noMatchingTasks")}
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
  const t = useTranslations("Dashboard.tasks");

  return (
    <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground text-sm">
      {t("noMatchingTasks")}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: Task["priority"] }) {
  const t = useTranslations("Dashboard.tasks");

  return (
    <Badge
      variant={priority === "High" ? "destructive" : "secondary"}
      className={cn(
        "rounded-md border-transparent",
        priority === "Medium" && "bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
        priority === "Low" && "bg-slate-500/10 text-slate-700 dark:bg-slate-500/15 dark:text-slate-300",
      )}
    >
      {t(`priorities.${priority}`)}
    </Badge>
  );
}

function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  locale,
  onTaskUpdated,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locale: string;
  onTaskUpdated: (task: ApiGymTask) => void;
}) {
  const t = useTranslations("Dashboard.tasks");
  const [pending, startTransition] = React.useTransition();
  const [comments, setComments] = React.useState<ApiGymTaskComment[]>([]);
  const [progress, setProgress] = React.useState(0);
  const [commentBody, setCommentBody] = React.useState("");

  React.useEffect(() => {
    if (!open || !task) {
      setComments([]);
      setCommentBody("");
      return;
    }

    setProgress(task.progress);

    if (!task.editable || !task.sourceId) {
      setComments([]);
      return;
    }

    let cancelled = false;

    startTransition(async () => {
      const result = await getGymTaskDetail(task.sourceId as number);

      if (cancelled) {
        return;
      }

      if (!result.ok) {
        toast.error(t("taskNotLoaded"), { description: result.message });
        return;
      }

      setComments(result.task.comments);
      setProgress(result.task.progress);
    });

    return () => {
      cancelled = true;
    };
  }, [open, task, t]);

  if (!task) {
    return null;
  }

  function saveProgress() {
    if (!task?.editable || !task.sourceId) {
      return;
    }

    startTransition(async () => {
      const result = await updateGymTaskProgress(task.sourceId as number, progress);

      if (!result.ok) {
        toast.error(t("progressNotSaved"), { description: result.message });
        return;
      }

      if (result.task) {
        onTaskUpdated(result.task);
      }

      toast.success(result.message);
    });
  }

  function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!task?.editable || !task.sourceId || !commentBody.trim()) {
      return;
    }

    startTransition(async () => {
      const result = await createGymTaskComment(task.sourceId as number, commentBody.trim());

      if (!result.ok) {
        toast.error(t("commentNotAdded"), { description: result.message });
        return;
      }

      setComments((current) => [...current, result.comment]);
      setCommentBody("");
      toast.success(result.message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
          <DialogDescription>{task.description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-3 rounded-lg border bg-muted/20 p-4 text-sm sm:grid-cols-4">
            <InfoItem label={t("owner")} value={task.owner.name} />
            <InfoItem label={t("dueDate")} value={task.dueDate} />
            <InfoItem label={t("team")} value={t(`teams.${task.team}`)} />
            <InfoItem label={t("source")} value={task.editable ? t("sources.manualTask") : t("sources.backendAlert")} />
          </div>

          <div className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-sm">{t("progress")}</div>
                <div className="text-muted-foreground text-xs">
                  {task.editable ? t("assignedProgressDescription") : t("generatedProgressDescription")}
                </div>
              </div>
              <div className="font-medium text-sm tabular-nums">{progress}%</div>
            </div>
            <Input
              disabled={!task.editable || pending}
              max={100}
              min={0}
              onChange={(event) => setProgress(Number(event.target.value))}
              step={5}
              type="range"
              value={progress}
            />
            {task.editable ? (
              <div className="mt-3 flex justify-end">
                <Button disabled={pending || progress === task.progress} size="sm" onClick={saveProgress}>
                  {t("saveProgress")}
                </Button>
              </div>
            ) : null}
          </div>

          {!task.editable && task.href ? (
            <div className="rounded-lg border p-4">
              <div className="font-medium text-sm">{t("backendSource")}</div>
              <p className="mt-1 text-muted-foreground text-sm">{t("generatedSourceDescription")}</p>
              <Button render={<a href={task.href} />} nativeButton={false} className="mt-3" size="sm" variant="outline">
                {t("openSourcePage")}
                <ExternalLink />
              </Button>
            </div>
          ) : null}

          <div className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{t("comments")}</div>
                <div className="text-muted-foreground text-xs">{t("commentsLongDescription")}</div>
              </div>
              <Badge variant="secondary">{comments.length}</Badge>
            </div>

            {task.editable ? (
              <form className="mb-4 grid gap-2" onSubmit={submitComment}>
                <Textarea
                  disabled={pending}
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder={t("addUpdatePlaceholder")}
                  value={commentBody}
                />
                <div className="flex justify-end">
                  <Button disabled={pending || !commentBody.trim()} size="sm" type="submit">
                    {t("addComment")}
                  </Button>
                </div>
              </form>
            ) : null}

            <div className="grid gap-3">
              {comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="rounded-md bg-muted/40 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-sm">{comment.user?.name ?? t("system")}</div>
                      <div className="text-muted-foreground text-xs">
                        {formatCommentDate(comment.created_at, locale, t("justNow"))}
                      </div>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-md bg-muted/40 p-4 text-muted-foreground text-sm">
                  {task.editable ? t("noComments") : t("generatedNoComments")}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

function CreateTaskDialog({
  employees,
  locale,
  open,
  onOpenChange,
  onTaskCreated,
}: {
  employees: KanbanProps["employees"];
  locale: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTaskCreated: (task: ApiGymTask) => void;
}) {
  const t = useTranslations("Dashboard.tasks");
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

      toast.error(t("taskNotCreated"), { description: result.message });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("addGymTask")}</DialogTitle>
          <DialogDescription>{t("addGymTaskDescription")}</DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="task-title">{t("titleField")}</Label>
              <Input id="task-title" name="title" required placeholder={t("titlePlaceholder")} />
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="task-description">{t("descriptionField")}</Label>
              <Textarea id="task-description" name="description" placeholder={t("descriptionPlaceholder")} />
            </div>
            <TaskSelect name="status" label={t("status")} options={getStatusOptions(t)} />
            <TaskSelect name="priority" label={t("priority")} options={getPriorityOptions(t)} />
            <TaskSelect name="category" label={t("category")} options={getCategoryOptions(t)} />
            <div className="grid gap-2">
              <Label>{t("dueDate")}</Label>
              <input name="due_date" type="hidden" value={dueDateValue} />
              <Popover>
                <PopoverTrigger
                  render={<Button type="button" variant="outline" className="justify-start text-left font-normal" />}
                >
                  <CalendarDays />
                  {dueDate ? formatDisplayDate(dueDate, locale) : t("pickDueDate")}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto p-2">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} fixedWeeks />
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="task-employee">{t("assignedEmployee")}</Label>
              <Select
                value={selectedEmployeeId}
                onValueChange={(value) => value && setSelectedEmployeeId(value)}
                name="assigned_employee_id"
              >
                <SelectTrigger id="task-employee" className="w-full">
                  <span className="truncate">{selectedEmployee ? selectedEmployee.name : t("noEmployee")}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="none">{t("noEmployee")}</SelectItem>
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
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? t("creating") : t("createTask")}
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

function getFilterLabel(
  filter: "all" | "editable" | "generated" | "high",
  t: ReturnType<typeof useTranslations<"Dashboard.tasks">>,
) {
  if (filter === "editable") return t("sources.manual");
  if (filter === "generated") return t("sources.backend");
  if (filter === "high") return t("urgent");

  return t("filter");
}

function getSortLabel(sort: "default" | "priority" | "due", t: ReturnType<typeof useTranslations<"Dashboard.tasks">>) {
  if (sort === "priority") return t("priority");
  if (sort === "due") return t("dueDate");

  return t("sort");
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

function formatDisplayDate(date: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatCommentDate(value: string | null, locale: string, fallback: string) {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(date);
}

function getStatusOptions(t: ReturnType<typeof useTranslations<"Dashboard.tasks">>) {
  return [
    { label: t("statuses.planned"), value: "planned" },
    { label: t("statuses.ideas"), value: "ideas" },
    { label: t("statuses.doing"), value: "doing" },
    { label: t("statuses.review"), value: "review" },
  ] as const;
}

function getPriorityOptions(t: ReturnType<typeof useTranslations<"Dashboard.tasks">>) {
  return [
    { label: t("priorities.Medium"), value: "medium" },
    { label: t("priorities.High"), value: "high" },
    { label: t("priorities.Low"), value: "low" },
  ] as const;
}

function getCategoryOptions(t: ReturnType<typeof useTranslations<"Dashboard.tasks">>) {
  return [
    { label: t("teams.Operations"), value: "operations" },
    { label: t("teams.Membership"), value: "membership" },
    { label: t("teams.Attendance"), value: "attendance" },
    { label: t("teams.Finance"), value: "finance" },
    { label: t("teams.Payroll"), value: "payroll" },
    { label: t("teams.Inventory"), value: "inventory" },
    { label: t("teams.Maintenance"), value: "maintenance" },
  ] as const;
}
