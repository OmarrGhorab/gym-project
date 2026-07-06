"use client";

import * as React from "react";

import { toast } from "sonner";

import { FieldError } from "@/components/ui/field";

import type { SettingsActionResult } from "./actions";

type SettingsAction = (input: FormData) => Promise<SettingsActionResult>;

export function SettingsActionForm({
  action,
  children,
  className,
}: {
  action: SettingsAction;
  children: React.ReactNode;
  className?: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<SettingsActionResult["errors"]>({});

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await action(formData);
      setErrors(result.errors ?? {});

      if (result.ok) {
        toast.success(result.message);
        return;
      }

      toast.error(result.message);
    });
  }

  const errorEntries = Object.entries(errors ?? {}).flatMap(([field, messages]) =>
    (messages ?? []).map((message) => `${formatFieldName(field)}: ${message}`),
  );

  return (
    <form action={submit} className={className} aria-busy={pending}>
      {children}
      {errorEntries.length > 0 ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2">
          <FieldError errors={errorEntries} />
        </div>
      ) : null}
    </form>
  );
}

export function SettingsActionButton({
  action,
  children,
  formData,
  variant,
}: {
  action: SettingsAction;
  children: React.ReactNode;
  formData: Record<string, string>;
  variant?: "outline" | "default";
}) {
  const [pending, startTransition] = React.useTransition();

  function submit() {
    const input = new FormData();

    for (const [key, value] of Object.entries(formData)) {
      input.set(key, value);
    }

    startTransition(async () => {
      const result = await action(input);

      if (result.ok) {
        toast.success(result.message);
        return;
      }

      toast.error(result.message);
    });
  }

  return (
    <button
      type="button"
      className="inline-flex h-8 min-w-24 items-center justify-center gap-1 whitespace-nowrap rounded-md border border-input bg-background px-3 font-medium text-sm transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50"
      disabled={pending}
      data-variant={variant ?? "outline"}
      onClick={submit}
    >
      {children}
    </button>
  );
}

function formatFieldName(field: string) {
  return field.replaceAll("_", " ").replaceAll(".", " ");
}
