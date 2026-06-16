"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { googleCallback, getFriendlyError } from "@/lib/auth";

export function GoogleCallbackHandler() {
  const t = useTranslations("GoogleCallback");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState(t("processing"));

  useEffect(() => {
    let cancelled = false;

    async function handleCallback() {
      try {
        await googleCallback(searchParams);
        if (!cancelled) {
          setStatus("success");
          setMessage(t("success"));
          router.push("/");
        }
      } catch (err) {
        if (!cancelled) {
          setStatus("error");
          setMessage(getFriendlyError(err));
        }
      }
    }

    handleCallback();

    return () => {
      cancelled = true;
    };
  }, [searchParams, router, t]);

  return (
    <div className="flex flex-col items-center justify-center space-y-4 text-center">
      <div
        className={`size-12 animate-spin rounded-full border-4 border-[#ffe800] border-t-transparent ${
          status === "error" ? "hidden" : "block"
        }`}
      />
      <p
        className={`text-lg font-medium ${
          status === "error" ? "text-destructive" : "text-foreground"
        }`}
      >
        {message}
      </p>
    </div>
  );
}
