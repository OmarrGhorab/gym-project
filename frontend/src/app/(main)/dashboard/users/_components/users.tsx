"use client";

import * as React from "react";

import Link from "next/link";

import { ShieldCheck, UserCog, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getInitials } from "@/lib/utils";

import { syncUserRoles, type UserRoleActionResult } from "./actions";
import type { AccessRole, AccessUser } from "./data";

export function Users({ roles, users }: { roles: AccessRole[]; users: AccessUser[] }) {
  const t = useTranslations("Dashboard.users");
  const assignedUsers = users.filter((user) => user.roles.length > 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1">
        <h1 className="text-3xl tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
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
