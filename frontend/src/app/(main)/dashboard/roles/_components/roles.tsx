"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { EllipsisVertical, Plus, Search, ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { createRole, deleteRole, type RoleActionResult, updateRole } from "./actions";
import type { PermissionGroup, RoleRow } from "./data-live";

const PRESET_ORDER = ["Admin", "Manager", "Cashier", "Captain", "Accountant"];

export function Roles({ permissionGroups, roles }: { permissionGroups: PermissionGroup[]; roles: RoleRow[] }) {
  const t = useTranslations("Dashboard.roles");
  const [query, setQuery] = React.useState("");
  const [type, setType] = React.useState("all");
  const [status, setStatus] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(true);

  function openCreatePanel() {
    setCreateOpen(true);
    requestAnimationFrame(() => document.getElementById("create-role")?.scrollIntoView({ behavior: "smooth" }));
  }

  const filteredRoles = roles.filter((role) => {
    const matchesQuery =
      query.trim().length === 0 ||
      role.name.toLowerCase().includes(query.toLowerCase()) ||
      role.permissions.some((permission) => permission.toLowerCase().includes(query.toLowerCase()));
    const matchesType = type === "all" || (type === "preset" ? role.is_preset : !role.is_preset);
    const matchesStatus = status === "all" || (status === "needs-review" ? role.is_preset : !role.is_preset);

    return matchesQuery && matchesType && matchesStatus;
  });
  const presetRoles = filteredRoles.filter((role) => role.is_preset).sort(sortPresetRoles);
  const customRoles = filteredRoles.filter((role) => !role.is_preset);
  const permissionCount = permissionGroups.reduce((sum, group) => sum + group.permissions.length, 0);

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={openCreatePanel}>
            <Plus />
            {t("createRole")}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="roles">
        <TabsList variant="line">
          <TabsTrigger value="roles">{t("roles")}</TabsTrigger>
          <TabsTrigger value="permissions">{t("permissionSets")}</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
              <InputGroup className="max-w-md">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  aria-label={t("searchPlaceholder")}
                  placeholder={t("searchPlaceholder")}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </InputGroup>
              <div className="flex flex-wrap gap-2">
                <Select value={type} onValueChange={(value) => setType(value ?? "all")}>
                  <SelectTrigger size="sm">
                    <span className="text-muted-foreground">{t("type")}</span>
                    <span>{filterLabel(type, t)}</span>
                  </SelectTrigger>
                  <SelectContent align="end" alignItemWithTrigger={false}>
                    <SelectGroup>
                      <SelectItem value="all">{t("all")}</SelectItem>
                      <SelectItem value="preset">{t("preset")}</SelectItem>
                      <SelectItem value="custom">{t("custom")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={(value) => setStatus(value ?? "all")}>
                  <SelectTrigger size="sm">
                    <span className="text-muted-foreground">{t("status")}</span>
                    <span>{filterLabel(status, t)}</span>
                  </SelectTrigger>
                  <SelectContent align="end" alignItemWithTrigger={false}>
                    <SelectGroup>
                      <SelectItem value="all">{t("all")}</SelectItem>
                      <SelectItem value="needs-review">{t("needsReview")}</SelectItem>
                      <SelectItem value="active">{t("active")}</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("accessLevel")}</TableHead>
                  <TableHead>{t("users")}</TableHead>
                  <TableHead>{t("permissionSets")}</TableHead>
                  <TableHead>{t("owner")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                <GroupHeader count={presetRoles.length} label={t("needsReview")} />
                {presetRoles.map((role) => (
                  <RoleTableRow key={role.id} permissionGroups={permissionGroups} role={role} />
                ))}
                <GroupHeader count={customRoles.length} label={t("customRoles")} />
                {customRoles.map((role) => (
                  <RoleTableRow key={role.id} permissionGroups={permissionGroups} role={role} />
                ))}
                {filteredRoles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      {t("noMatches")}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between border-t px-4 py-3 text-muted-foreground text-sm">
              <span>{t("showingRoles", { visible: filteredRoles.length, total: roles.length })}</span>
              <span>{t("permissionsAvailable", { count: permissionCount })}</span>
            </div>
          </div>

          <CreateRolePanel open={createOpen} onOpenChange={setCreateOpen} permissionGroups={permissionGroups} />
        </TabsContent>

        <TabsContent value="permissions">
          <PermissionSets permissionGroups={permissionGroups} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RoleTableRow({ permissionGroups, role }: { permissionGroups: PermissionGroup[]; role: RoleRow }) {
  const t = useTranslations("Dashboard.roles");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Partial<Record<string, string[]>>>({});
  const chips = role.permissions.slice(0, 3);
  const extra = Math.max(role.permissions.length - chips.length, 0);
  const accessLevel = role.permissions.some((permission) => permission === "roles.manage") ? t("full") : t("scoped");
  const handleActionResult = useRoleActionToast();

  function submitUpdate(formData: FormData) {
    startTransition(async () => {
      const result = await updateRole(formData);

      setErrors(result.errors ?? {});
      handleActionResult(result);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  function submitDelete(formData: FormData) {
    startTransition(async () => {
      const result = await deleteRole(formData);

      handleActionResult(result);

      if (result.ok) {
        router.refresh();
      }
    });
  }

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{role.name}</TableCell>
        <TableCell>
          <Badge variant="outline">{accessLevel}</Badge>
        </TableCell>
        <TableCell className="tabular-nums">{role.users_count}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {chips.map((permission) => (
              <Badge key={permission} variant="outline">
                {permissionLabel(permission)}
              </Badge>
            ))}
            {extra > 0 ? <Badge variant="outline">+{extra}</Badge> : null}
          </div>
        </TableCell>
        <TableCell>{role.is_preset ? t("system") : t("admin")}</TableCell>
        <TableCell>
          <Badge variant={role.is_preset ? "outline" : "secondary"}>
            {role.is_preset ? t("needsReview") : t("active")}
          </Badge>
        </TableCell>
        <TableCell className="text-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label={t("openActions", { role: role.name })} />}
            >
              <EllipsisVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-48">
              <DropdownMenuGroup>
                <DropdownMenuItem className="whitespace-nowrap" onClick={() => setOpen((value) => !value)}>
                  <ShieldCheck />
                  {open ? t("hidePermissions") : t("editPermissions")}
                </DropdownMenuItem>
                {role.is_preset ? (
                  <DropdownMenuItem disabled>
                    <span className="text-muted-foreground">{t("needsReview")}</span>
                  </DropdownMenuItem>
                ) : null}
                {!role.is_preset ? (
                  <DropdownMenuItem render={<button form={`delete-role-${role.id}`} type="submit" />}>
                    {t("deleteRole")}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {!role.is_preset ? (
            <form action={submitDelete} id={`delete-role-${role.id}`}>
              <input type="hidden" name="id" value={role.id} />
            </form>
          ) : null}
        </TableCell>
      </TableRow>
      {open ? (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/20 p-4">
            <form action={submitUpdate} className="rounded-lg border bg-card p-4">
              <input type="hidden" name="id" value={role.id} />
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-sm space-y-2">
                  <Label htmlFor={`role-name-${role.id}`}>{t("roleName")}</Label>
                  <Input
                    id={`role-name-${role.id}`}
                    name="name"
                    defaultValue={role.name}
                    readOnly={role.is_preset}
                    aria-readonly={role.is_preset}
                    aria-invalid={Boolean(errors.name?.[0])}
                  />
                  <FieldError errors={errors.name} />
                </div>
                <Button type="submit" size="sm" disabled={pending}>
                  {t("savePermissions")}
                </Button>
              </div>
              <FieldError errors={errors.permissions} />
              <PermissionPicker permissionGroups={permissionGroups} selected={role.permissions} compact />
            </form>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}

function CreateRolePanel({
  onOpenChange,
  open,
  permissionGroups,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  permissionGroups: PermissionGroup[];
}) {
  const t = useTranslations("Dashboard.roles");
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Partial<Record<string, string[]>>>({});
  const handleActionResult = useRoleActionToast();

  function submitCreate(formData: FormData) {
    startTransition(async () => {
      const result = await createRole(formData);

      setErrors(result.errors ?? {});
      handleActionResult(result);

      if (result.ok) {
        onOpenChange(false);
        router.refresh();
      }
    });
  }

  return (
    <Collapsible id="create-role" open={open} onOpenChange={onOpenChange} className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-medium">{t("createRole")}</h2>
          <p className="text-muted-foreground text-sm">{t("createDescription")}</p>
        </div>
        <CollapsibleTrigger render={<Button size="sm" variant="outline" />}>
          {open ? t("close") : t("openForm")}
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="border-t p-4">
        <form action={submitCreate} className="grid gap-4">
          <div className="max-w-sm space-y-2">
            <Label htmlFor="role-name">{t("roleName")}</Label>
            <Input
              id="role-name"
              name="name"
              placeholder={t("rolePlaceholder")}
              aria-invalid={Boolean(errors.name?.[0])}
            />
            <FieldError errors={errors.name} />
          </div>
          <FieldError errors={errors.permissions} />
          <PermissionPicker permissionGroups={permissionGroups} selected={[]} compact />
          <Button type="submit" className="w-fit" disabled={pending}>
            {t("createRole")}
          </Button>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}

function PermissionSets({ permissionGroups }: { permissionGroups: PermissionGroup[] }) {
  const t = useTranslations("Dashboard.roles");

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("group")}</TableHead>
            <TableHead>{t("permissions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {permissionGroups.map((group) => (
            <TableRow key={group.group}>
              <TableCell className="font-medium">{groupLabel(group.group)}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {group.permissions.map((permission) => (
                    <Badge key={permission.name} variant="outline">
                      {permissionActionLabel(permission.name)}
                    </Badge>
                  ))}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function PermissionPicker({
  compact = false,
  disabled = false,
  permissionGroups,
  selected,
}: {
  compact?: boolean;
  disabled?: boolean;
  permissionGroups: PermissionGroup[];
  selected: string[];
}) {
  const t = useTranslations("Dashboard.roles");
  const [checkedPermissions, setCheckedPermissions] = React.useState(() => new Set(selected));

  React.useEffect(() => {
    setCheckedPermissions(new Set(selected));
  }, [selected]);

  function togglePermission(permission: string, checked: boolean) {
    setCheckedPermissions((current) => {
      const next = new Set(current);

      if (checked) {
        next.add(permission);
      } else {
        next.delete(permission);
      }

      return next;
    });
  }

  return (
    <div className={cn("grid gap-3", compact ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-3")}>
      {permissionGroups.map((group) => (
        <div className="rounded-lg border p-3" key={group.group}>
          <div className="mb-2 font-medium text-sm">{groupLabel(group.group)}</div>
          <div className="grid gap-2">
            {group.permissions.map((permission) => {
              const isChecked = checkedPermissions.has(permission.name);

              return (
                <div
                  key={permission.name}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted",
                    disabled && "opacity-60 hover:bg-transparent",
                  )}
                >
                  <Checkbox
                    id={`permission-${permission.name}`}
                    name="permissions"
                    value={permission.name}
                    checked={isChecked}
                    onCheckedChange={(checked) => togglePermission(permission.name, Boolean(checked))}
                    disabled={disabled}
                    aria-label={t("togglePermission", { permission: permission.name })}
                  />
                  <button
                    type="button"
                    className={cn(
                      "min-w-0 flex-1 select-none truncate text-start font-medium leading-none",
                      disabled ? "cursor-not-allowed" : "cursor-pointer",
                    )}
                    disabled={disabled}
                    onClick={() => togglePermission(permission.name, !isChecked)}
                  >
                    {permissionActionLabel(permission.name)}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function GroupHeader({ count, label }: { count: number; label: string }) {
  return (
    <TableRow className="bg-muted/70 hover:bg-muted/70">
      <TableCell colSpan={7} className="h-8 py-0 text-muted-foreground text-sm">
        {label} <Badge variant="outline">{count}</Badge>
      </TableCell>
    </TableRow>
  );
}

function useRoleActionToast() {
  return React.useCallback((result: RoleActionResult) => {
    if (result.ok) {
      toast.success(result.message);
      return;
    }

    toast.error("Role action failed", { description: result.message });
  }, []);
}

function permissionLabel(permission: string) {
  return groupLabel(permission.split(".").at(0) ?? permission);
}

function permissionActionLabel(permission: string) {
  const permissionLabels: Record<string, string> = {
    "roles.manage": "Manage roles",
    "settings.manage": "Manage settings",
    "audit.view": "View audit",
    "export.members": "Export members",
    "export.subscriptions": "Export subscriptions",
    "export.sales": "Export sales",
    "export.payments": "Export payments",
    "export.payroll": "Export payroll",
    "export.reports": "Export reports",
    "export.attendance": "Export attendance",
    "export.member-visits": "Export member visits",
    "commissions.earn_sales": "Earn sales commission",
  };

  if (permissionLabels[permission]) {
    return permissionLabels[permission];
  }

  const action = permission.split(".").at(-1) ?? permission;

  return action
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function groupLabel(group: string) {
  return group
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function filterLabel(value: string, t: ReturnType<typeof useTranslations<"Dashboard.roles">>) {
  if (value === "all") {
    return t("all");
  }

  if (value === "needs-review") {
    return t("needsReview");
  }

  if (value === "preset") {
    return t("preset");
  }

  if (value === "custom") {
    return t("custom");
  }

  if (value === "active") {
    return t("active");
  }

  return groupLabel(value);
}

function sortPresetRoles(a: RoleRow, b: RoleRow) {
  return PRESET_ORDER.indexOf(a.name) - PRESET_ORDER.indexOf(b.name);
}
