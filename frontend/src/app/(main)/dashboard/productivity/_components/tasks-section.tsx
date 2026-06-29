"use client";

import { Calendar1 } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import type { OperationsTask } from "./data";

function priorityVariant(priority: OperationsTask["priority"]) {
  return priority === "high" ? "destructive" : "outline";
}

export function TasksSection({ tasks }: { tasks: OperationsTask[] }) {
  const t = useTranslations("Dashboard.productivity");

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl tracking-tight">{t("operationsQueue")}</h2>
        <Button render={<a href="/dashboard/analytics" />} nativeButton={false} variant="outline">
          {t("attendanceReview")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border bg-background shadow-xs">
        <div className="divide-y">
          {tasks.length > 0 ? (
            tasks.map((task) => (
              <a
                href={task.href}
                key={task.id}
                className="flex items-center gap-2 p-4 transition-colors hover:bg-muted/40"
              >
                <Checkbox checked={false} aria-label={task.title} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center lg:gap-4">
                      <span className="truncate text-sm">{task.title}</span>
                      <Badge variant={priorityVariant(task.priority)} className="w-fit px-3 py-1 font-normal">
                        {task.tag}
                      </Badge>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-muted-foreground text-sm">
                      <span className="max-w-56 truncate">{task.due_label}</span>
                      <Calendar1 className="size-4" />
                    </div>
                  </div>
                </div>
              </a>
            ))
          ) : (
            <div className="flex h-32 items-center justify-center text-muted-foreground text-sm">
              {t("noUrgentOperations")}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
