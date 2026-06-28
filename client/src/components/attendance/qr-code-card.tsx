"use client";

import * as React from "react";
import { QRCodeSVG } from "qrcode.react";
import { QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type QrCodeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  payload: string | null | undefined;
  codeLabel?: string;
  closeLabel: string;
  printLabel?: string;
  isArabic?: boolean;
};

export function QrCodeDialog({
  open,
  onOpenChange,
  title,
  description,
  payload,
  codeLabel,
  closeLabel,
  printLabel,
  isArabic = false,
}: QrCodeDialogProps) {
  function handlePrint() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-sm", isArabic && "rtl")}>
        <DialogHeader className={cn(isArabic && "text-right")}>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid place-items-center rounded-lg border bg-background p-6">
          {payload ? (
            <div className="space-y-4 text-center">
              <div className="rounded-md bg-white p-4 shadow-sm">
                <QRCodeSVG value={payload} size={192} level="M" includeMargin />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {codeLabel}
                </p>
                <p className="mt-1 break-all rounded-md bg-muted px-3 py-2 font-mono text-xs font-bold text-foreground">
                  {payload}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid place-items-center gap-3 py-8 text-center text-sm font-semibold text-muted-foreground">
              <span className="grid size-12 place-items-center rounded-lg bg-muted text-muted-foreground">
                <QrCode className="size-5" />
              </span>
              {description}
            </div>
          )}
        </div>

        <DialogFooter className={cn("gap-2 sm:gap-2", isArabic && "flex-row-reverse")}>
          {payload && printLabel ? (
            <Button type="button" variant="outline" onClick={handlePrint}>
              {printLabel}
            </Button>
          ) : null}
          <Button type="button" onClick={() => onOpenChange(false)}>
            {closeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
