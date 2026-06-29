"use client";

import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clock3,
  EllipsisVertical,
  FileText,
  Gauge,
  Settings,
  ShieldAlert,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

import type { SystemHealthAudit, SystemHealthGroup, SystemHealthStatus, SystemHealthWarning } from "./data";

export function ProjectEnvironments({ group }: { group: SystemHealthGroup }) {
  const t = useTranslations("Dashboard.infrastructure");
  const warningCount = group.rows.filter((row) => row.status === "warning" || row.status === "critical").length;

  return (
    <Collapsible
      defaultOpen
      className="flex flex-col overflow-hidden rounded-xl border bg-card py-3 text-card-foreground data-open:gap-3 data-open:pb-0"
    >
      <div className="flex flex-col gap-2 px-4 sm:flex-row sm:items-center">
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              className="group -ml-2 h-auto w-full justify-start gap-2 px-2 py-1 hover:bg-transparent aria-expanded:bg-transparent sm:flex-1"
            />
          }
        >
          <ChevronDown className="group-data-panel-open:rotate-180" />
          <div className="flex min-w-0 flex-col gap-1 text-left sm:flex-row sm:items-baseline">
            <span className="shrink-0 font-medium leading-none">{group.name}</span>
            <span className="min-w-0 truncate text-muted-foreground text-sm">{group.description}</span>
          </div>
        </CollapsibleTrigger>
        <div className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:justify-end">
          <Badge variant="outline" className="rounded-sm px-1.5 py-0.5">
            {t("moduleCount", { count: group.rows.length })}
          </Badge>
          {warningCount > 0 ? (
            <Badge variant="outline" className="rounded-sm px-1.5 py-0.5 text-amber-600 dark:text-amber-400">
              {t("warningCount", { count: warningCount })}
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-sm px-1.5 py-0.5 text-emerald-600 dark:text-emerald-400">
              {t("ready")}
            </Badge>
          )}
        </div>
      </div>

      <CollapsibleContent>
        {group.rows.length > 0 ? <EnvironmentTable rows={group.rows} /> : <EmptyProjectState />}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SystemHealthSidePanel({
  audits,
  warnings,
}: {
  audits: SystemHealthAudit[];
  warnings: SystemHealthWarning[];
}) {
  const t = useTranslations("Dashboard.infrastructure");
  const locale = useLocale();

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <section className="rounded-xl border bg-card p-4 text-card-foreground">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">{t("setupAttention")}</h2>
            <p className="text-muted-foreground text-sm">{t("setupAttentionDescription")}</p>
          </div>
          <ShieldAlert className="size-4 text-muted-foreground" />
        </div>
        <div className="space-y-3">
          {warnings.length > 0 ? (
            warnings.map((warning) => (
              <a
                href={warning.href}
                key={`${warning.title}-${warning.href}`}
                className="flex items-start gap-3 rounded-lg border bg-background p-3 transition-colors hover:bg-muted/60"
              >
                <StatusIcon status={warning.status} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium text-sm">{warning.title}</span>
                  <span className="line-clamp-2 text-muted-foreground text-xs">{warning.description}</span>
                </span>
                <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
              </a>
            ))
          ) : (
            <div className="rounded-lg border bg-muted/40 p-4 text-muted-foreground text-sm">
              {t("noSetupWarnings")}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border bg-card p-4 text-card-foreground">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-medium">{t("recentAudit")}</h2>
            <p className="text-muted-foreground text-sm">{t("recentAuditDescription")}</p>
          </div>
          <FileText className="size-4 text-muted-foreground" />
        </div>
        <div className="space-y-3">
          {audits.length > 0 ? (
            audits.map((audit) => (
              <div key={audit.id} className="flex items-start gap-3 rounded-lg border bg-background p-3">
                <span className="rounded-md bg-muted p-2 text-muted-foreground">
                  <Clock3 className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-sm">{audit.description}</span>
                  <span className="block text-muted-foreground text-xs">
                    {audit.log_name} {audit.causer ? t("byUser", { user: audit.causer }) : ""} ·{" "}
                    {formatRelativeDate(audit.created_at, locale, t)}
                  </span>
                </span>
              </div>
            ))
          ) : (
            <div className="rounded-lg border bg-muted/40 p-4 text-muted-foreground text-sm">{t("noAudit")}</div>
          )}
        </div>
      </section>
    </div>
  );
}

function EnvironmentTable({ rows }: { rows: SystemHealthGroup["rows"] }) {
  const t = useTranslations("Dashboard.infrastructure");
  const locale = useLocale();

  return (
    <div className="overflow-hidden border-t">
      <Table className="table-fixed **:data-[slot='table-cell']:px-5 **:data-[slot='table-head']:px-5">
        <colgroup>
          <col className="w-[28%]" />
          <col className="w-[14%]" />
          <col className="w-[14%]" />
          <col className="w-[29%]" />
          <col className="w-[11%]" />
          <col className="w-[4%]" />
        </colgroup>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>{t("module")}</TableHead>
            <TableHead>{t("status")}</TableHead>
            <TableHead>{t("metric")}</TableHead>
            <TableHead>{t("checks")}</TableHead>
            <TableHead>{t("lastActivity")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.name}>
              <TableCell>
                <div className="min-w-0">
                  <a href={row.href} className="block truncate font-medium hover:underline" title={row.name}>
                    {row.name}
                  </a>
                  <p className="line-clamp-2 text-muted-foreground text-xs">{row.description}</p>
                </div>
              </TableCell>
              <TableCell>
                <StatusBadge status={row.status} />
              </TableCell>
              <TableCell>
                <span className="flex flex-col">
                  <span className="font-medium tabular-nums">{row.metric}</span>
                  <span className="text-muted-foreground text-xs">{row.category}</span>
                </span>
              </TableCell>
              <TableCell>
                <div className="grid gap-2 sm:grid-cols-2">
                  {row.checks.map((check) => (
                    <div key={`${row.name}-${check.label}`} className="rounded-md border bg-background px-2 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-muted-foreground text-xs">{check.label}</span>
                        <span className={cn("font-medium text-xs tabular-nums", statusTextClass(check.status))}>
                          {check.value}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </TableCell>
              <TableCell>
                <span className="text-muted-foreground text-sm">
                  {formatRelativeDate(row.last_activity, locale, t)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" className="-mr-2" />}>
                    <EllipsisVertical />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-40" align="end">
                    <DropdownMenuGroup>
                      <DropdownMenuItem render={<a href={row.href} />}>
                        <ArrowUpRight />
                        {t("openPage")}
                      </DropdownMenuItem>
                      <DropdownMenuItem render={<a href="/dashboard/settings" />}>
                        <Settings />
                        {t("settings")}
                      </DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function StatusBadge({ status }: { status: SystemHealthStatus }) {
  const t = useTranslations("Dashboard.infrastructure");

  return (
    <Badge
      variant={status === "critical" ? "destructive" : "secondary"}
      className={cn("rounded-sm px-1.5 py-0.5", statusBadgeClass(status))}
    >
      <StatusIcon status={status} />
      {t(`statuses.${status}`)}
    </Badge>
  );
}

function StatusIcon({ status }: { status: SystemHealthStatus }) {
  if (status === "ready") {
    return <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />;
  }

  if (status === "critical") {
    return <AlertCircle className="size-3.5 text-destructive" />;
  }

  if (status === "warning") {
    return <Gauge className="size-3.5 text-amber-600 dark:text-amber-400" />;
  }

  return <CircleDashed className="size-3.5 text-muted-foreground" />;
}

function statusBadgeClass(status: SystemHealthStatus) {
  if (status === "ready") {
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }

  if (status === "warning") {
    return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  }

  return "";
}

function statusTextClass(status: SystemHealthStatus) {
  if (status === "ready") {
    return "text-emerald-600 dark:text-emerald-400";
  }

  if (status === "warning") {
    return "text-amber-600 dark:text-amber-400";
  }

  if (status === "critical") {
    return "text-destructive";
  }

  return "text-muted-foreground";
}

function formatRelativeDate(
  value: string | null,
  locale: string,
  t: ReturnType<typeof useTranslations<"Dashboard.infrastructure">>,
) {
  if (!value) {
    return t("noActivity");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return t("noActivity");
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60_000));

  if (diffMinutes < 1) {
    return t("justNow");
  }

  if (diffMinutes < 60) {
    return t("minutesAgo", { count: diffMinutes });
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return t("hoursAgo", { count: diffHours });
  }

  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}

function EmptyProjectState() {
  const t = useTranslations("Dashboard.infrastructure");

  return (
    <div className="flex min-h-24 items-center justify-center border-t bg-muted/50 p-4">
      <div className="flex items-center gap-2">
        <CircleDashed className="size-4" />
        <p className="font-medium text-sm">{t("noModules")}</p>
      </div>
    </div>
  );
}
