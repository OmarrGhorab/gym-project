"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { MembersTable } from "@/components/members/members-table";
import { MemberFormDialog } from "@/components/members/member-form-dialog";
import { MembersPagination } from "@/components/members/members-pagination";
import type { Member, Paginated, Plan } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

type MembersTableContainerProps = {
  members: Member[];
  meta: Paginated<Member>["meta"];
  plans: Plan[];
  filters: {
    search?: string;
    status?: string;
    gender?: string;
    planId?: string;
  };
};

export function MembersTableContainer({
  members,
  meta,
  plans,
  filters,
}: MembersTableContainerProps) {
  const locale = useLocale();
  const t = useTranslations("MembersPage");
  const router = useRouter();
  const isArabic = locale === "ar";

  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [editingMember, setEditingMember] = React.useState<Member | null>(null);

  function handleMutate() {
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex px-4 pt-4",
          isArabic ? "justify-start" : "justify-end"
        )}
      >
        <Button
          type="button"
          className="gap-2 bg-primary text-primary-foreground font-bold hover:bg-primary/95 transition-all shadow-sm rounded-lg hover:scale-[1.01]"
          onClick={() => setIsAddOpen(true)}
        >
          <Plus className="size-4" />
          <span>{t("addButton")}</span>
        </Button>
      </div>

      <div className="px-4">
        <MembersTable
          members={members}
          onEditMember={setEditingMember}
          onMutate={handleMutate}
        />
      </div>

      {meta.last_page > 1 && (
        <MembersPagination
          currentPage={meta.current_page}
          lastPage={meta.last_page}
          filters={filters}
        />
      )}

      <MemberFormDialog
        mode="add"
        plans={plans}
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        onSuccess={handleMutate}
      />

      <MemberFormDialog
        mode="edit"
        plans={plans}
        member={editingMember}
        open={editingMember !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingMember(null);
          }
        }}
        onSuccess={handleMutate}
      />
    </div>
  );
}
