import Link from "next/link";

import { ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

export default async function Page() {
  const t = await getTranslations("Dashboard.crm");

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h1 className="font-medium text-sm leading-none">{t("chatPreview")}</h1>
          <p className="text-muted-foreground text-sm">{t("chatPreviewDescription")}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          nativeButton={false}
          render={
            <Link href="/chat" target="_blank" rel="noreferrer" prefetch={false} aria-label={t("openChatNewTab")} />
          }
        >
          <ExternalLink />
        </Button>
      </div>

      <iframe src="/chat" title={t("chatPreview")} className="min-h-0 flex-1 rounded-lg border bg-background" />
    </div>
  );
}
