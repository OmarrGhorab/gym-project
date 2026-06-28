"use client";

import { Bell, CalendarClock, CircleDollarSign, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const notifications = [
  {
    id: "trial-ending",
    title: "3 memberships expire today",
    description: "Review renewals before closing.",
    icon: CalendarClock,
  },
  {
    id: "payment-due",
    title: "2 payments need follow-up",
    description: "Outstanding dues were detected.",
    icon: CircleDollarSign,
  },
  {
    id: "new-member",
    title: "New member registered",
    description: "Profile is ready for review.",
    icon: UserPlus,
  },
];

export function NotificationMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button size="icon" aria-label="Open notifications">
            <Bell />
          </Button>
        }
      />
      <DropdownMenuContent className="w-80 rounded-lg" align="end" side="bottom" sideOffset={8}>
        <div className="px-2 py-1.5">
          <p className="font-medium text-sm">Notifications</p>
          <p className="text-muted-foreground text-xs">Latest gym activity</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {notifications.map((notification) => {
            const Icon = notification.icon;

            return (
              <DropdownMenuItem key={notification.id} className="items-start gap-2 py-2">
                <Icon className="mt-0.5" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="font-medium">{notification.title}</span>
                  <span className="text-muted-foreground text-xs">{notification.description}</span>
                </span>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
