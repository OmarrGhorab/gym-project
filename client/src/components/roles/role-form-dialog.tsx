"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppLocale } from "@/i18n/routing";
import { createRole, updateRole } from "@/lib/actions/roles";
import type { PermissionCatalog, Role } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

type RoleFormDialogProps = {
  mode: "add" | "edit";
  role?: Role | null;
  permissions: PermissionCatalog;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

type RoleFormState = {
  name: string;
  permissions: string[];
};

export function RoleFormDialog(props: RoleFormDialogProps) {
  const formKey = `${props.mode}-${props.role?.id ?? "new"}-${props.open ? "open" : "closed"}`;

  return <RoleFormDialogContent key={formKey} {...props} />;
}

function RoleFormDialogContent({
  mode,
  role,
  permissions,
  open,
  onOpenChange,
  onSuccess,
}: RoleFormDialogProps) {
  const locale = useLocale();
  const t = useTranslations("RolesPage");
  const isArabic = locale === "ar";
  const isEditing = mode === "edit";
  const isPreset = Boolean(role?.is_preset);
  const permissionEntries = React.useMemo(
    () => Object.entries(permissions).sort(([a], [b]) => a.localeCompare(b)),
    [permissions]
  );
  const availablePermissions = React.useMemo(
    () => permissionEntries.flatMap(([, values]) => values),
    [permissionEntries]
  );
  const [isPending, setIsPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]>>({});
  const [form, setForm] = React.useState<RoleFormState>(() => ({
    name: role?.name ?? "",
    permissions: role?.permissions ?? [],
  }));

  function togglePermission(permission: string, checked: boolean) {
    setForm((current) => ({
      ...current,
      permissions: checked
        ? Array.from(new Set([...current.permissions, permission]))
        : current.permissions.filter((item) => item !== permission),
    }));
  }

  function toggleGroup(groupPermissions: string[], checked: boolean) {
    setForm((current) => ({
      ...current,
      permissions: checked
        ? Array.from(new Set([...current.permissions, ...groupPermissions]))
        : current.permissions.filter((item) => !groupPermissions.includes(item)),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsPending(true);
    setError(null);
    setFieldErrors({});

    const validationErrors = validateRoleForm({
      form,
      availablePermissions,
      messages: {
        name: t("nameValidation"),
        permission: t("permissionValidation"),
      },
    });

    if (Object.keys(validationErrors).length > 0) {
      setError(t("formError"));
      setFieldErrors(validationErrors);
      toast.error(t("formError"));
      setIsPending(false);
      return;
    }

    const payload = {
      name: form.name.trim(),
      permissions: form.permissions,
    };

    try {
      if (isEditing && role) {
        await updateRole(role.id, payload, locale as AppLocale);
      } else {
        await createRole(payload, locale as AppLocale);
      }

      toast.success(isEditing ? t("roleUpdatedSuccess") : t("roleCreatedSuccess"));
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      const parsedError = parseActionError(err);

      if (parsedError) {
        setError(parsedError.message);
        setFieldErrors(parsedError.details ?? {});
        toast.error(parsedError.message);
      } else {
        const message = err instanceof Error ? err.message : t("formError");
        setError(message);
        toast.error(message);
      }
    } finally {
      setIsPending(false);
    }
  }

  const disabled = isPending || isPreset;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[88vh] max-w-4xl overflow-y-auto", isArabic && "rtl")}>
        <DialogHeader className={cn(isArabic && "text-right")}>
          <DialogTitle>
            {isEditing ? t("editRoleTitle") : t("addRoleTitle")}
          </DialogTitle>
          <DialogDescription>
            {isPreset
              ? t("presetEditDescription")
              : isEditing
                ? t("editRoleDescription")
                : t("addRoleDescription")}
          </DialogDescription>
        </DialogHeader>

        <form id="role-form" onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm font-semibold text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="role-name" className={cn(isArabic && "justify-end")}>
              {t("formName")} *
            </Label>
            <Input
              id="role-name"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              disabled={disabled}
              className={cn("h-9", isArabic ? "text-right" : "text-left")}
            />
            <FieldError messages={fieldErrors.name} />
          </div>

          <div className="space-y-3">
            <div className={cn(isArabic && "text-right")}>
              <p className="text-sm font-bold text-foreground">
                {t("permissionsTitle")}
              </p>
              <p className="text-xs font-semibold text-muted-foreground">
                {t("permissionsDescription", {
                  count: form.permissions.length,
                })}
              </p>
            </div>
            <FieldError messages={fieldErrors.permissions} />

            <div className="grid gap-3 lg:grid-cols-2">
              {permissionEntries.map(([group, groupPermissions]) => {
                const selectedCount = groupPermissions.filter((permission) =>
                  form.permissions.includes(permission)
                ).length;
                const allSelected = selectedCount === groupPermissions.length;

                return (
                  <section
                    key={group}
                    className="rounded-lg border bg-muted/10 p-3"
                  >
                    <div
                      className={cn(
                        "mb-3 flex items-start justify-between gap-3",
                        isArabic && "flex-row-reverse text-right"
                      )}
                    >
                      <div>
                        <h3 className="text-sm font-black text-foreground">
                          {formatGroup(group)}
                        </h3>
                        <p className="text-xs font-semibold text-muted-foreground">
                          {t("groupCount", {
                            selected: selectedCount,
                            total: groupPermissions.length,
                          })}
                        </p>
                      </div>
                      <label
                        className={cn(
                          "flex items-center gap-2 text-xs font-bold text-foreground",
                          isArabic && "flex-row-reverse"
                        )}
                      >
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={(checked) =>
                            toggleGroup(groupPermissions, checked === true)
                          }
                          disabled={disabled}
                        />
                        <span>{t("selectGroup")}</span>
                      </label>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2">
                      {groupPermissions.map((permission) => (
                        <label
                          key={permission}
                          className={cn(
                            "flex min-h-9 items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs font-semibold text-foreground",
                            isArabic && "flex-row-reverse text-right"
                          )}
                        >
                          <Checkbox
                            checked={form.permissions.includes(permission)}
                            onCheckedChange={(checked) =>
                              togglePermission(permission, checked === true)
                            }
                            disabled={disabled}
                          />
                          <span>{formatPermission(permission)}</span>
                        </label>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </form>

        <DialogFooter className={cn("gap-2 sm:gap-2", isArabic && "flex-row-reverse")}>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            {t("formCancel")}
          </Button>
          <Button type="submit" form="role-form" disabled={disabled}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEditing ? t("formSave") : t("formAdd")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;

  return <p className="text-xs font-medium text-destructive">{messages[0]}</p>;
}

function validateRoleForm({
  form,
  availablePermissions,
  messages,
}: {
  form: RoleFormState;
  availablePermissions: string[];
  messages: {
    name: string;
    permission: string;
  };
}) {
  const permissionSet = new Set(availablePermissions);
  const schema = z.object({
    name: z.string().trim().min(2, messages.name).max(255, messages.name),
    permissions: z
      .array(z.string())
      .refine(
        (value) => value.every((permission) => permissionSet.has(permission)),
        messages.permission
      ),
  });

  const result = schema.safeParse(form);

  if (result.success) {
    return {};
  }

  return Object.fromEntries(
    result.error.issues.map((issue) => [
      issue.path.join(".") || "permissions",
      [issue.message],
    ])
  );
}

function parseActionError(
  err: unknown
): { message: string; details?: Record<string, string[]> } | null {
  if (!(err instanceof Error)) return null;

  try {
    const parsed = JSON.parse(err.message) as {
      message?: string;
      details?: Record<string, string[]>;
    };

    return parsed.message
      ? { message: parsed.message, details: parsed.details }
      : null;
  } catch {
    return null;
  }
}

function formatGroup(group: string) {
  return group
    .split(/[-_.]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatPermission(permission: string) {
  return permission
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" ");
}
