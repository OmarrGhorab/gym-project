"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

export function PrintBadgesButton({ label }: { label: string }) {
  return (
    <Button onClick={() => window.print()} size="sm" type="button">
      <Printer className="size-4" />
      {label}
    </Button>
  );
}
