"use client";

import Link from "next/link";

import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="grid size-14 place-items-center rounded-2xl border bg-muted text-muted-foreground">
        <SearchX className="size-6" />
      </div>
      <div className="space-y-2">
        <h1 className="font-semibold text-2xl">Page not found.</h1>
        <p className="text-muted-foreground">The page you are looking for could not be found.</p>
      </div>
      <Link prefetch={false} replace href="/dashboard/default">
        <Button variant="outline">Go back home</Button>
      </Link>
    </div>
  );
}
