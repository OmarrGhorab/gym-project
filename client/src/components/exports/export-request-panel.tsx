"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { requestExport, type ExportRequestData } from "@/lib/actions/exports";
import type { ExportStatus } from "@/lib/api/dashboard";

const resources = ["members", "subscriptions", "sales", "payments", "payroll", "reports"] as const;
const formats = ["xlsx", "csv", "pdf"] as const;

export function ExportRequestPanel() {
  const t = useTranslations("ExportsPage");
  const [resource, setResource] = React.useState<ExportRequestData["resource"]>("reports");
  const [format, setFormat] = React.useState<ExportRequestData["format"]>("xlsx");
  const [isPending, setIsPending] = React.useState(false);
  const [result, setResult] = React.useState<ExportStatus | null>(null);

  async function handleExport() {
    setIsPending(true);
    setResult(null);
    try {
      const response = await requestExport({ resource, format });
      setResult(response);
      toast.success(response.status === "processing" ? t("exportQueued") : t("exportReady"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("exportError"));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("resourceLabel")}</Label>
          <Select value={resource} onValueChange={(value) => setResource(value as ExportRequestData["resource"])}>
            <SelectTrigger className="h-9 w-full bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {resources.map((item) => (
                <SelectItem key={item} value={item}>
                  {t(`resources.${item}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("formatLabel")}</Label>
          <Select value={format} onValueChange={(value) => setFormat(value as ExportRequestData["format"])}>
            <SelectTrigger className="h-9 w-full bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              {formats.map((item) => (
                <SelectItem key={item} value={item}>
                  {item.toUpperCase()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={handleExport} disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {t("requestButton")}
        </Button>
        {result?.download_url && (
          <Button asChild type="button" variant="outline">
            <a href={result.download_url} download={`${resource}.${format}`}>
              <Download className="size-4" />
              {t("downloadButton")}
            </a>
          </Button>
        )}
      </div>

      {result && (
        <div className="rounded-lg border bg-muted/20 p-3 text-sm">
          <p className="font-bold text-foreground">{t("resultTitle")}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {t("resultDescription", {
              id: result.export_id,
              status: result.status,
            })}
          </p>
        </div>
      )}
    </div>
  );
}
