import { Banknote, ChartNoAxesColumn, Dumbbell, Package, Users } from "lucide-react";

import { Button } from "@/components/ui/button";

import type { OperationsQuickAction } from "./data";

const icons = [ChartNoAxesColumn, Users, Banknote, Dumbbell, Package] as const;

export function QuickActions({ actions }: { actions: OperationsQuickAction[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xl tracking-tight">Quick Actions</h2>
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
