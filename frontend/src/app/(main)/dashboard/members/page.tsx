import { getLocale, getTranslations } from "next-intl/server";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/session";
import { formatCurrency, getInitials } from "@/lib/utils";

import { getMembersPageData } from "./_components/data";
import { MemberActionsMenu } from "./_components/member-action-dialogs";
import { MembersFilterBar, MembersHeaderActions, MembersPagination } from "./_components/members-toolbar";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations("Dashboard.membersPage");
  const locale = await getLocale();
  const user = await getCurrentUser();
  const numberFormatter = new Intl.NumberFormat(locale);
  const params = await searchParams;
  const query = normalizeQuery(params);
  const { dues, members, meta, plans, staff } = await getMembersPageData(query);
  const active = members.filter((member) => member.status === "active").length;
  const inactive = members.length - active;
  const withQr = members.filter((member) => member.attendance_qr).length;
  const currentPage = Number(meta.current_page ?? query.page ?? 1);
  const lastPage = Number(meta.last_page ?? 1);
  const perPage = String(meta.per_page ?? query.per_page ?? "15");

  return (
    <Card className="mx-auto w-full max-w-[1440px] overflow-hidden">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-2xl tracking-tight">{t("title")}</h1>
            <p className="text-muted-foreground text-sm">{t("description")}</p>
          </div>
          <MembersHeaderActions user={user} />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <MembersFilterBar total={members.length} />
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 text-muted-foreground text-sm">
          <span>{t("selected", { count: numberFormatter.format(0) })}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Metric label={t("total")} value={numberFormatter.format(members.length)} />
            <Metric label={t("active")} value={numberFormatter.format(active)} />
            <Metric label={t("inactive")} value={numberFormatter.format(inactive)} />
            <Metric label={t("qrReady")} value={numberFormatter.format(withQr)} />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox aria-label={t("selectAll")} />
              </TableHead>
              <TableHead>{t("member")}</TableHead>
              <TableHead>{t("subscription")}</TableHead>
              <TableHead>{t("qr")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("totalPaid")}</TableHead>
              <TableHead>{t("joinedDate")}</TableHead>
              <TableHead className="text-end">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length > 0 ? (
              members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <Checkbox aria-label={t("selectMember", { name: member.name })} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                        {member.has_photo ? <AvatarImage src={getMemberPhotoUrl(member)} alt={member.name} /> : null}
                        <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">{member.name}</div>
                        <div className="text-muted-foreground text-xs">{member.phone}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{member.latest_subscription?.plan_name ?? t("noSubscription")}</div>
                    <div className="text-muted-foreground text-xs">
                      {member.latest_subscription?.status ?? t("none")} · {member.expiry_date ?? t("noExpiry")}
                    </div>
                  </TableCell>
                  <TableCell>
                    {member.attendance_qr ? (
                      <Badge variant="outline">{t("ready")}</Badge>
                    ) : (
                      <Badge variant="outline">{t("missing")}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={member.status === "active" ? "secondary" : "outline"}>{member.status}</Badge>
                  </TableCell>
                  <TableCell>
                    {formatCurrency(Number(member.total_paid), { currency: "EGP", noDecimals: true })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{member.join_date ?? "-"}</TableCell>
                  <TableCell className="text-end">
                    <MemberActionsMenu
                      member={member}
                      plans={plans}
                      staff={staff}
                      due={dues[member.id] ?? null}
                      permissions={user?.permissions ?? []}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {t("noMembers")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <MembersPagination currentPage={currentPage} lastPage={lastPage} perPage={perPage} />
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-md border px-2 py-1">
      {label}: <span className="text-foreground tabular-nums">{value}</span>
    </span>
  );
}

function normalizeQuery(params: Record<string, string | string[] | undefined>) {
  return {
    page: readParam(params.page),
    per_page: readParam(params.per_page),
    plan: readParam(params.plan),
    q: readParam(params.q),
    qr: readParam(params.qr),
    status: readParam(params.status),
  };
}

function readParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getMemberPhotoUrl(member: { id: number; updated_at?: string | null }) {
  const version = member.updated_at ? `?v=${encodeURIComponent(member.updated_at)}` : "";

  return `/api/media/members/${member.id}/photo${version}`;
}
