"use client";

import * as React from "react";
import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { MemberQrPassDialog } from "@/components/members/member-qr-pass";
import type { Member } from "@/lib/api/dashboard";

export function MemberProfileQrAction({ member }: { member: Member }) {
  const t = useTranslations("MembersPage");
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <Button type="button" variant="outline" className="gap-2" onClick={() => setIsOpen(true)}>
        <Printer className="size-4" />
        {t("qrPassPrint")}
      </Button>
      <MemberQrPassDialog member={member} open={isOpen} onOpenChange={setIsOpen} />
    </>
  );
}
