"use client";

import Image from "next/image";
import type { DashboardUser } from "@/components/dashboard/types";

export function UserAvatar({ user }: { user: DashboardUser }) {
  const initials = getInitials(user.name);

  if (user.imageUrl) {
    return (
      <Image
        src={user.imageUrl}
        alt={user.name}
        width={40}
        height={40}
        className="size-10 rounded-full border object-cover"
      />
    );
  }

  return (
    <div
      aria-label={user.name}
      className="grid size-10 place-items-center rounded-full border bg-primary text-sm font-black text-primary-foreground"
      title={user.name}
    >
      {initials}
    </div>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "A";
  const second = parts.length > 1 ? parts[parts.length - 1]?.[0] : parts[0]?.[1];

  return `${first}${second ?? ""}`.toUpperCase();
}
