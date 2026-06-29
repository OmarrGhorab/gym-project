"use client";

import { ClipboardCheck, CreditCard, Dumbbell, PackageCheck } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import type { OperationsWorkflow } from "./data";

const icons = [ClipboardCheck, CreditCard, Dumbbell, PackageCheck] as const;

export function ProjectsSection({ workflows }: { workflows: OperationsWorkflow[] }) {
  const t = useTranslations("Dashboard.productivity");

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl tracking-tight">{t("operationalWorkflows")}</h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {workflows.map((workflow, index) => {
          const Icon = icons[index % icons.length];

          return (
            <a href={workflow.href} key={workflow.title}>
              <Card className="h-full shadow-xs transition-colors hover:bg-muted/30">
                <CardHeader>
                  <CardTitle>
                    <div className="flex items-center gap-2">
                      <Icon className="size-4 text-muted-foreground" />
                      <span>{workflow.title}</span>
                    </div>
                  </CardTitle>
                  <CardAction>
                    <Badge variant="outline">{workflow.status}</Badge>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    <div className="text-sm leading-snug">{workflow.description}</div>
                    <div className="flex items-center gap-3">
                      <Progress value={workflow.progress} className="h-2" />
                      <span className="shrink-0 text-sm">{workflow.progress}%</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="py-2.5">
                  <span className="text-muted-foreground">{workflow.footer}</span>
                </CardFooter>
              </Card>
            </a>
          );
        })}
      </div>
    </section>
  );
}
