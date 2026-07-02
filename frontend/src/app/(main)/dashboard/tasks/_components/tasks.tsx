"use client";
"use no memo";

import * as React from "react";

import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type PaginationState,
  type SortingState,
  useReactTable,
  type VisibilityState,
} from "@tanstack/react-table";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { createGymTaskComment, getGymTaskDetail, updateGymTaskProgress } from "../../kanban/_components/actions";
import { toTask } from "../../kanban/_components/mappers";
import type { ApiGymTask, ApiGymTaskComment } from "../../kanban/_components/types";
import { getColumns } from "./columns";
import { TasksToolbar } from "./tasks-toolbar";
import { sourceLabel, type Task } from "./types";

interface TasksProps {
  data: Task[];
}

function preventPaginationNavigation(event: React.MouseEvent<HTMLAnchorElement>) {
  event.preventDefault();
}

function getPageNumbers(currentPage: number, pageCount: number) {
  if (pageCount <= 3) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  if (currentPage <= 2) return [1, 2, 3];
  if (currentPage >= pageCount - 1) return [pageCount - 2, pageCount - 1, pageCount];

  return [currentPage - 1, currentPage, currentPage + 1];
}

export function Tasks({ data }: TasksProps) {
  const t = useTranslations("Dashboard.tasks");
  const locale = useLocale();
  const [tasks, setTasks] = React.useState(data);
  const [detailTask, setDetailTask] = React.useState<Task | null>(null);
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [pagination, setPagination] = React.useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });

  const columns = React.useMemo(() => getColumns(setDetailTask, t), [t]);

  const table = useReactTable({
    data: tasks,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
      pagination,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const pageIndex = table.getState().pagination.pageIndex;
  const pageCount = Math.max(table.getPageCount(), 1);
  const currentPage = Math.min(pageIndex + 1, pageCount);
  const pageNumbers = getPageNumbers(currentPage, pageCount);
  const canPreviousPage = table.getCanPreviousPage();
  const canNextPage = table.getCanNextPage();

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background">
      <div className="border-b px-4 py-4">
        <TasksToolbar table={table} />
      </div>
      <Table className="**:data-[slot=table-cell]:px-4 **:data-[slot=table-head]:px-4">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="hover:bg-transparent">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} className="h-11 font-medium text-muted-foreground" colSpan={header.colSpan}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="border-border/60 hover:bg-muted/20"
                data-state={row.getIsSelected() && "selected"}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={table.getVisibleLeafColumns().length} className="h-24 text-center">
                {t("noResults")}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div className="flex flex-col gap-3 border-t px-4 py-4 md:flex-row md:items-center md:justify-between">
        <div className="text-muted-foreground text-sm">
          {t("selectedRows", {
            selected: table.getFilteredSelectedRowModel().rows.length,
            total: table.getFilteredRowModel().rows.length,
          })}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-6 lg:gap-8">
          <div className="flex items-center gap-2">
            <p className="font-medium text-muted-foreground text-sm">{t("rowsPerPage")}</p>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(value) => {
                table.setPageSize(Number(value));
              }}
            >
              <SelectTrigger className="h-8 w-18">
                <SelectValue placeholder={table.getState().pagination.pageSize} />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {[10, 20, 30, 40, 50].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-24 items-center justify-start font-medium text-sm sm:justify-center">
            {t("pageOf", { page: currentPage, total: pageCount })}
          </div>
          <Pagination className="mx-0 w-auto justify-start sm:justify-end">
            <PaginationContent className="gap-1">
              <PaginationItem className="hidden lg:block">
                <PaginationLink
                  href="#"
                  aria-label={t("goFirst")}
                  aria-disabled={!canPreviousPage}
                  className={cn(!canPreviousPage && "pointer-events-none opacity-50")}
                  onClick={(event) => {
                    preventPaginationNavigation(event);
                    if (canPreviousPage) table.setPageIndex(0);
                  }}
                >
                  <ChevronsLeft />
                </PaginationLink>
              </PaginationItem>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  text={t("prev")}
                  aria-disabled={!canPreviousPage}
                  className={cn(!canPreviousPage && "pointer-events-none opacity-50")}
                  onClick={(event) => {
                    preventPaginationNavigation(event);
                    if (canPreviousPage) table.previousPage();
                  }}
                />
              </PaginationItem>
              {pageNumbers[0] > 1 ? (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : null}
              {pageNumbers.map((pageNumber) => (
                <PaginationItem key={pageNumber}>
                  <PaginationLink
                    href="#"
                    isActive={pageIndex === pageNumber - 1}
                    onClick={(event) => {
                      preventPaginationNavigation(event);
                      table.setPageIndex(pageNumber - 1);
                    }}
                  >
                    {pageNumber}
                  </PaginationLink>
                </PaginationItem>
              ))}
              {pageNumbers[pageNumbers.length - 1] < pageCount ? (
                <PaginationItem>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : null}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  aria-disabled={!canNextPage}
                  className={cn(!canNextPage && "pointer-events-none opacity-50")}
                  onClick={(event) => {
                    preventPaginationNavigation(event);
                    if (canNextPage) table.nextPage();
                  }}
                />
              </PaginationItem>
              <PaginationItem className="hidden lg:block">
                <PaginationLink
                  href="#"
                  aria-label={t("goLast")}
                  aria-disabled={!canNextPage}
                  className={cn(!canNextPage && "pointer-events-none opacity-50")}
                  onClick={(event) => {
                    preventPaginationNavigation(event);
                    if (canNextPage) table.setPageIndex(pageCount - 1);
                  }}
                >
                  <ChevronsRight />
                </PaginationLink>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
      <TaskDetailsDialog
        task={detailTask}
        open={detailTask !== null}
        onOpenChange={(open) => !open && setDetailTask(null)}
        locale={locale}
        onTaskUpdated={(task) => {
          const nextTask = toActionTask(task);
          setTasks((current) => current.map((item) => (item.id === nextTask.id ? nextTask : item)));
          setDetailTask(nextTask);
        }}
      />
    </div>
  );
}

function TaskDetailsDialog({
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

      if (cancelled) return;

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

  if (!task) return null;

  function saveProgress() {
    if (!task?.editable || !task.sourceId) return;

    startTransition(async () => {
      const result = await updateGymTaskProgress(task.sourceId as number, progress);

      if (!result.ok) {
        toast.error(t("progressNotSaved"), { description: result.message });
        return;
      }

      if (result.task) onTaskUpdated(result.task);
      toast.success(result.message);
    });
  }

  function submitComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task?.editable || !task.sourceId || !commentBody.trim()) return;

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
            <InfoItem label={t("assignedTo")} value={task.owner.name} />
            <InfoItem label={t("dueDate")} value={task.dueDate} />
            <InfoItem label={t("team")} value={task.team} />
            <InfoItem label={t("source")} value={task.sourceLabel} />
          </div>

          <div className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{t("progress")}</div>
                <div className="text-muted-foreground text-xs">
                  {task.editable ? t("progressManualDescription") : t("progressReadonlyDescription")}
                </div>
              </div>
              <div className="font-medium text-sm tabular-nums">{progress}%</div>
            </div>
            <input
              className="w-full accent-primary"
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

          {task.href ? (
            <div className="rounded-lg border p-4">
              <div className="font-medium text-sm">{t("backendSource")}</div>
              <p className="mt-1 text-muted-foreground text-sm">{t("backendSourceDescription")}</p>
              <Button render={<a href={task.href} />} nativeButton={false} className="mt-3" size="sm" variant="outline">
                {t("openSourcePage")}
              </Button>
            </div>
          ) : null}

          <div className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-medium text-sm">{t("comments")}</div>
                <div className="text-muted-foreground text-xs">{t("commentsDescription")}</div>
              </div>
              <Badge variant="secondary">{comments.length}</Badge>
            </div>

            {task.editable ? (
              <form className="mb-4 grid gap-2" onSubmit={submitComment}>
                <Textarea
                  disabled={pending}
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder={t("addTaskUpdate")}
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

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function toActionTask(task: ApiGymTask): Task {
  return {
    ...toTask(task),
    sourceLabel: sourceLabel(task.source),
    status: task.status,
  };
}

function formatCommentDate(value: string | null, locale: string, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  }).format(date);
}
