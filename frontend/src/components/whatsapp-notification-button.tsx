"use client";

import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function buildWhatsAppLink(phone: string, data: Record<string, unknown>, lang: "ar" | "en" = "ar") {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const formattedPhone = cleanPhone.startsWith("01") ? `20${cleanPhone.slice(1)}` : cleanPhone;

  const memberName = String(data.member_name ?? data.member ?? data.name ?? "Member");
  const planName = String(data.plan_name ?? data.plan ?? "Subscription");
  const endDate = String(data.end_date ?? data.endDate ?? "");
  const sessionsRemaining =
    data.sessions_remaining !== undefined && data.sessions_remaining !== null ? Number(data.sessions_remaining) : null;

  let message = "";

  if (lang === "ar") {
    if (sessionsRemaining !== null && sessionsRemaining === 0) {
      message = `مرحباً ${memberName} 👋\n\nنود إعلامك بأن جميع الحصص الخاصة باشتراكك (${planName}) قد انتهت.\nيسعدنا زيارتك للصالة الرياضية لتجديد اشتراكك وحجز حصصك القادمة! 🏋️‍♂️✨`;
    } else if (sessionsRemaining !== null && sessionsRemaining > 0) {
      message = `مرحباً ${memberName} 👋\n\nنود تذكيرك بأنه متبقي لديك (${sessionsRemaining}) حصة فقط في اشتراكك (${planName}).\nيسعدنا زيارتك للصالة الرياضية لتجديد اشتراكك ومتابعة تدريباتك! 🏋️‍♂️✨`;
    } else if (endDate) {
      message = `مرحباً ${memberName} 👋\n\nنود تذكيرك بأن اشتراكك في (${planName}) ينتهي بتاريخ (${endDate}).\nيسعدنا زيارتك للصالة الرياضية لتجديد الاشتراك ومتابعة لياقتك البدنية! 🏋️‍♂️✨`;
    } else {
      message = `مرحباً ${memberName} 👋\n\nنود تذكيرك بمتابعة وتجديد اشتراكك في (${planName}). يسعدنا دوماً حضورك وتدريبك معنا! 🏋️‍♂️✨`;
    }
  } else {
    if (sessionsRemaining !== null && sessionsRemaining === 0) {
      message = `Hello ${memberName} 👋\n\nWe would like to remind you that all sessions for your subscription (${planName}) have been completed.\nWe look forward to seeing you at the gym to renew your plan! 🏋️‍♂️✨`;
    } else if (sessionsRemaining !== null && sessionsRemaining > 0) {
      message = `Hello ${memberName} 👋\n\nWe would like to remind you that you have only (${sessionsRemaining}) session(s) remaining for your subscription (${planName}).\nWe look forward to seeing you at the gym to renew your plan! 🏋️‍♂️✨`;
    } else if (endDate) {
      message = `Hello ${memberName} 👋\n\nWe would like to remind you that your subscription (${planName}) expires on (${endDate}).\nWe look forward to seeing you at the gym to renew your membership! 🏋️‍♂️✨`;
    } else {
      message = `Hello ${memberName} 👋\n\nWe would like to remind you to renew your subscription (${planName}). We look forward to seeing you at the gym! 🏋️‍♂️✨`;
    }
  }

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

export function WhatsAppNotificationButton({
  phone,
  data,
  size = "sm",
  variant = "outline",
  className = "",
}: {
  phone: string | null | undefined;
  data: Record<string, unknown>;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  className?: string;
}) {
  if (!phone) {
    return null;
  }

  const arLink = buildWhatsAppLink(phone, data, "ar");
  const enLink = buildWhatsAppLink(phone, data, "en");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            size={size}
            variant={variant}
            className={`gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 hover:text-emerald-700 dark:text-emerald-400 ${className}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          >
            <MessageCircle className="size-4 fill-emerald-500/20 text-emerald-600 dark:text-emerald-400" />
            WhatsApp
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="min-w-40">
        <DropdownMenuItem
          render={<a href={arLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} />}
        >
          WhatsApp (العربية)
        </DropdownMenuItem>
        <DropdownMenuItem
          render={<a href={enLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} />}
        >
          WhatsApp (English)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
