"use client";

import * as React from "react";

import Link from "next/link";

import { Plus, ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInitials } from "@/lib/utils";

import { type CreateUserActionResult, createUserAccount, syncUserRoles, type UserRoleActionResult } from "./actions";
import type { AccessRole, AccessUser, EmployeeOption } from "./data";

export function Users({
  employeeOptions,
  roles,
  users,
}: {
  employeeOptions: EmployeeOption[];
  roles: AccessRole[];
  users: AccessUser[];
}) {
  const t = useTranslations("Dashboard.users");
  const assignedUsers = users.filter((user) => user.roles.length > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <CreateAccountDialog employeeOptions={employeeOptions} roles={roles} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Summary icon={UsersRound} label={t("users")} value={users.length.toString()} />
        <Summary icon={UserCog} label={t("withRoles")} value={assignedUsers.toString()} />
        <Summary icon={ShieldCheck} label={t("availableRoles")} value={roles.length.toString()} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-normal">{t("accessAssignments")}</CardTitle>
          <CardDescription>{t("accessDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("user")}</TableHead>
                <TableHead>{t("staffProfile")}</TableHead>
                <TableHead>{t("currentRoles")}</TableHead>
                <TableHead>{t("permissions")}</TableHead>
                <TableHead className="w-[420px]">{t("assignRoles")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 items-center justify-center rounded-lg bg-muted font-medium text-sm">
                        {getInitials(user.name)}
                      </div>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-muted-foreground text-xs">{user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.linked_employee ? (
                      <Button
                        size="sm"
                        variant="outline"
                        nativeButton={false}
                        render={<Link href={`/dashboard/academy/staff#employee-${user.linked_employee.id}`} />}
                      >
                        {t("editStaffProfile")}
                      </Button>
                    ) : (
                      <Badge variant="outline">{t("noStaffProfile")}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.roles.length > 0 ? (
                        user.roles.map((role) => (
                          <Badge key={role} variant="secondary">
                            {role}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline">{t("noRole")}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{user.permissions.length}</TableCell>
                  <TableCell>
                    {roles.length > 0 ? (
                      <UserRoleForm roles={roles} user={user} />
                    ) : (
                      <div className="rounded-md border bg-muted/40 px-3 py-2 text-muted-foreground text-sm">
                        {t("noRolesAvailable")}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    {t("noUsers")}
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CreateAccountDialog({ employeeOptions, roles }: { employeeOptions: EmployeeOption[]; roles: AccessRole[] }) {
  const t = useTranslations("Dashboard.users");
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<CreateUserActionResult["errors"]>({});
  const formRef = React.useRef<HTMLFormElement>(null);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);

    if (!nextOpen) {
      setErrors({});
    }
  }

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await createUserAccount(formData);
      setErrors(result.errors ?? {});

      if (result.ok) {
        toast.success(t("accountCreated"));
        formRef.current?.reset();
        setOpen(false);
        return;
      }

      toast.error(t("accountCreationFailed"), { description: result.message });
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button className="shrink-0" disabled={roles.length === 0} />}>
        <Plus className="size-4" />
        {t("createAccount")}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("createAccount")}</DialogTitle>
          <DialogDescription>{t("createAccountDescription")}</DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-user-name">{t("name")}</Label>
              <Input
                id="create-user-name"
                name="name"
                autoComplete="name"
                required
                aria-invalid={Boolean(errors?.name)}
              />
              <FieldError errors={errors?.name} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-user-email">{t("email")}</Label>
              <Input
                id="create-user-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                aria-invalid={Boolean(errors?.email)}
              />
              <FieldError errors={errors?.email} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-user-password">{t("password")}</Label>
              <Input
                id="create-user-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                aria-invalid={Boolean(errors?.password)}
              />
              <FieldError errors={errors?.password} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-user-password-confirmation">{t("confirmPassword")}</Label>
              <Input
                id="create-user-password-confirmation"
                name="password_confirmation"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                aria-invalid={Boolean(errors?.password_confirmation)}
              />
              <FieldError errors={errors?.password_confirmation} />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="font-medium text-sm">{t("rolesRequired")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {roles.map((role) => {
                const id = `create-user-role-${role.id}`;

                return (
                  <div key={role.id} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                    <Checkbox id={id} name="roles" value={role.name} />
                    <Label htmlFor={id} className="min-w-0 truncate font-normal">
                      {role.name}
                    </Label>
                  </div>
                );
              })}
            </div>
            <FieldError errors={errors?.roles} />
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="create-user-employee">{t("staffProfileOptional")}</Label>
            <Select name="employee_id" defaultValue="none">
              <SelectTrigger id="create-user-employee" className="w-full" aria-invalid={Boolean(errors?.employee_id)}>
                <SelectValue placeholder={t("noStaffProfileLink")} />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="none">{t("noStaffProfileLink")}</SelectItem>
                  {employeeOptions.map((employee) => (
                    <SelectItem key={employee.id} value={String(employee.id)}>
                      {employee.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">{t("staffProfileHelp")}</p>
            <FieldError errors={errors?.employee_id} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? t("creatingAccount") : t("createAccount")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UserRoleForm({ roles, user }: { roles: AccessRole[]; user: AccessUser }) {
  const t = useTranslations("Dashboard.users");
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<UserRoleActionResult["errors"]>({});

  function submit(formData: FormData) {
    startTransition(async () => {
      const result = await syncUserRoles(formData);
      setErrors(result.errors ?? {});

      if (result.ok) {
        toast.success(result.message);
        return;
      }

      toast.error(result.message);
    });
  }

  return (
    <form action={submit} className="flex flex-col gap-3">
      <input type="hidden" name="user_id" value={user.id} />
      <FieldError errors={errors?.user_id} />
      <div className="grid grid-cols-2 gap-2">
        {roles.map((role) => {
          const id = `user-${user.id}-role-${role.id}`;

          return (
            <div key={role.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm">
              <Checkbox
                id={id}
                name="roles"
                value={role.name}
                defaultChecked={user.roles.includes(role.name)}
                aria-label={t("assignRoleToUser", { role: role.name, user: user.name })}
              />
              <Label htmlFor={id} className="min-w-0 truncate font-normal">
                {role.name}
              </Label>
            </div>
          );
        })}
      </div>
      <FieldError errors={errors?.roles} />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {t("saveRoles")}
      </Button>
    </form>
  );
}

function Summary({ icon: Icon, label, value }: { icon: typeof UsersRound; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="font-medium text-2xl tabular-nums">{value}</p>
        </div>
        <Icon className="size-5 text-muted-foreground" />
      </CardContent>
    </Card>
  );
}
