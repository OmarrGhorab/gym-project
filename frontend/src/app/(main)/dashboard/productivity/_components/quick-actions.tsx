"use client";

import { Banknote, ChartNoAxesColumn, Dumbbell, Package, Users } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

import type { OperationsQuickAction } from "./data";

const icons = [ChartNoAxesColumn, Users, Banknote, Dumbbell, Package] as const;

export function QuickActions({ actions }: { actions: OperationsQuickAction[] }) {
  const t = useTranslations("Dashboard.productivity");

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl tracking-tight">{t("quickActions")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {actions.map((action, index) => {
          const Icon = icons[index % icons.length];

          return (
            <Button
              key={action.label}
              render={<a href={action.href} />}
              nativeButton={false}
              variant="outline"
              className="justify-start"
            >
              <Icon data-icon="inline-start" />
              {action.label}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
