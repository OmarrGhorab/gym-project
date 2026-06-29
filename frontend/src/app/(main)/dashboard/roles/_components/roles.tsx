"use client";

import * as React from "react";

import { EllipsisVertical, Plus, Search, ShieldCheck } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { createRole, deleteRole, updateRole } from "./actions";
import type { PermissionGroup, RoleRow } from "./data-live";

const PRESET_ORDER = ["Admin", "Manager", "Cashier", "Captain", "Accountant"];

export function Roles({ permissionGroups, roles }: { permissionGroups: PermissionGroup[]; roles: RoleRow[] }) {
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
          <h1 className="text-3xl tracking-tight">Roles & Permissions</h1>
          <p className="text-muted-foreground text-sm">
            Manage access roles and permissions across your gym dashboard.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={openCreatePanel}>
            <Plus />
            Create role
          </Button>
        </div>
      </div>

      <Tabs defaultValue="roles">
        <TabsList variant="line">
          <TabsTrigger value="roles">Roles</TabsTrigger>
          <TabsTrigger value="permissions">Permission sets</TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="flex flex-col gap-3 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
              <InputGroup className="max-w-md">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  placeholder="Search roles or permissions..."
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </InputGroup>
              <div className="flex flex-wrap gap-2">
                <Select value={type} onValueChange={(value) => setType(value ?? "all")}>
                  <SelectTrigger size="sm">
                    <span className="text-muted-foreground">Type:</span>
                    <span>{filterLabel(type)}</span>
                  </SelectTrigger>
                  <SelectContent align="end" alignItemWithTrigger={false}>
                    <SelectGroup>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="preset">Preset</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={(value) => setStatus(value ?? "all")}>
                  <SelectTrigger size="sm">
                    <span className="text-muted-foreground">Status:</span>
                    <span>{filterLabel(status)}</span>
                  </SelectTrigger>
                  <SelectContent align="end" alignItemWithTrigger={false}>
                    <SelectGroup>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="needs-review">Needs review</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Access level</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Permission sets</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                <GroupHeader count={presetRoles.length} label="Needs review" />
                {presetRoles.map((role) => (
                  <RoleTableRow key={role.id} permissionGroups={permissionGroups} role={role} />
                ))}
                <GroupHeader count={customRoles.length} label="Custom roles" />
                {customRoles.map((role) => (
                  <RoleTableRow key={role.id} permissionGroups={permissionGroups} role={role} />
                ))}
                {filteredRoles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No roles match your filters.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between border-t px-4 py-3 text-muted-foreground text-sm">
              <span>
                Showing {filteredRoles.length} of {roles.length} roles
              </span>
              <span>{permissionCount} permissions available</span>
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
  const [open, setOpen] = React.useState(false);
  const chips = role.permissions.slice(0, 3);
  const extra = Math.max(role.permissions.length - chips.length, 0);
  const accessLevel = role.permissions.some((permission) => permission === "roles.manage") ? "Full" : "Scoped";

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
        <TableCell>{role.is_preset ? "System" : "Admin"}</TableCell>
        <TableCell>
          <Badge variant={role.is_preset ? "outline" : "secondary"}>{role.is_preset ? "Needs review" : "Active"}</Badge>
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label={`Open ${role.name} actions`} />}
            >
              <EllipsisVertical />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => setOpen((value) => !value)}>
                  <ShieldCheck />
                  {open ? "Hide permissions" : "Edit permissions"}
                </DropdownMenuItem>
                {!role.is_preset ? (
                  <DropdownMenuItem render={<button form={`delete-role-${role.id}`} type="submit" />}>
                    Delete role
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
      {open ? (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/20 p-4">
            <form action={updateRole} className="rounded-lg border bg-card p-4">
              <input type="hidden" name="id" value={role.id} />
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-sm space-y-2">
                  <Label htmlFor={`role-name-${role.id}`}>Role name</Label>
                  <Input id={`role-name-${role.id}`} name="name" defaultValue={role.name} disabled={role.is_preset} />
                </div>
                <Button type="submit" size="sm" disabled={role.is_preset}>
                  Save permissions
                </Button>
              </div>
              <PermissionPicker
                permissionGroups={permissionGroups}
                selected={role.permissions}
                disabled={role.is_preset}
                compact
              />
            </form>
            {!role.is_preset ? (
              <form action={deleteRole} id={`delete-role-${role.id}`}>
                <input type="hidden" name="id" value={role.id} />
              </form>
            ) : null}
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
  return (
    <Collapsible id="create-role" open={open} onOpenChange={onOpenChange} className="rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-3 p-4">
        <div>
          <h2 className="font-medium">Create role</h2>
          <p className="text-muted-foreground text-sm">Add a custom role without crowding the main table.</p>
        </div>
        <CollapsibleTrigger render={<Button size="sm" variant="outline" />}>
          {open ? "Close" : "Open form"}
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="border-t p-4">
        <form action={createRole} className="grid gap-4">
          <div className="max-w-sm space-y-2">
            <Label htmlFor="role-name">Role name</Label>
            <Input id="role-name" name="name" placeholder="Front Desk Manager" />
          </div>
          <PermissionPicker permissionGroups={permissionGroups} selected={[]} compact />
          <Button type="submit" className="w-fit">
            Create role
          </Button>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}

function PermissionSets({ permissionGroups }: { permissionGroups: PermissionGroup[] }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Group</TableHead>
            <TableHead>Permissions</TableHead>
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
  return (
    <div className={cn("grid gap-3", compact ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-2 xl:grid-cols-3")}>
      {permissionGroups.map((group) => (
        <div className="rounded-lg border p-3" key={group.group}>
          <div className="mb-2 font-medium text-sm">{groupLabel(group.group)}</div>
          <div className="grid gap-2">
            {group.permissions.map((permission) => (
              <div key={permission.name} className="flex items-center gap-2 text-sm">
                <Checkbox
                  name="permissions"
                  value={permission.name}
                  defaultChecked={selected.includes(permission.name)}
                  disabled={disabled}
                  aria-label={`Toggle ${permission.name}`}
                />
                <span className="min-w-0 truncate">{permissionActionLabel(permission.name)}</span>
              </div>
            ))}
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

function permissionLabel(permission: string) {
  return groupLabel(permission.split(".").at(0) ?? permission);
}

function permissionActionLabel(permission: string) {
  const action = permission.split(".").at(-1) ?? permission;

  return action
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function groupLabel(group: string) {
  return group
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function filterLabel(value: string) {
  if (value === "all") {
    return "All";
  }

  if (value === "needs-review") {
    return "Needs review";
  }

  return groupLabel(value);
}

function sortPresetRoles(a: RoleRow, b: RoleRow) {
  return PRESET_ORDER.indexOf(a.name) - PRESET_ORDER.indexOf(b.name);
}
