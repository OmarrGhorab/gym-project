"use client";

import * as React from "react";

import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  defaultWhatsAppTemplates,
  renderWhatsAppTemplate,
  type WhatsAppTemplateKey,
  type WhatsAppTemplates,
  whatsappTemplateKeys,
} from "@/lib/whatsapp-templates";

export function buildWhatsAppLink(
  phone: string,
  data: Record<string, unknown>,
  templates: WhatsAppTemplates = {},
  lang: "ar" | "en" = "ar",
  messageType?: WhatsAppTemplateKey,
) {
  const cleanPhone = phone.replace(/[^0-9]/g, "");
  const formattedPhone = cleanPhone.startsWith("01") ? `20${cleanPhone.slice(1)}` : cleanPhone;

  const memberName = String(data.member_name ?? data.member ?? data.name ?? "Member");
  const planName = String(data.plan_name ?? data.plan ?? "Subscription");
  const endDate = String(data.end_date ?? data.endDate ?? "");
  const sessionsRemaining =
    data.sessions_remaining !== undefined && data.sessions_remaining !== null ? Number(data.sessions_remaining) : null;

  const templateKey = messageType ?? resolveTemplateKey(sessionsRemaining, endDate);

  let message = renderWhatsAppTemplate(templates[templateKey] || defaultWhatsAppTemplates[templateKey], {
    amount_paid: String(data.amount_paid ?? data.price_paid ?? data.paid_amount ?? ""),
    barcode_url: String(data.barcode_url ?? data.attendance_qr ?? ""),
    end_date: endDate,
    member_name: memberName,
    plan_name: planName,
    sessions_remaining: sessionsRemaining,
    start_date: String(data.start_date ?? data.startDate ?? ""),
  });

  if (!templates[templateKey] && lang === "en") {
    if (sessionsRemaining !== null && sessionsRemaining === 0) {
      message = `Hello ${memberName} 👋\n\nAll sessions for your ${planName} subscription have been completed. We look forward to helping you renew!`;
    } else if (sessionsRemaining !== null && sessionsRemaining > 0) {
      message = `Hello ${memberName} 👋\n\nYou have ${sessionsRemaining} session(s) remaining in ${planName}.`;
    } else if (endDate) {
      message = `Hello ${memberName} 👋\n\nYour ${planName} subscription expires on ${endDate}. We look forward to helping you renew.`;
    } else {
      message = `Hello ${memberName} 👋\n\nYour ${planName} subscription has been renewed successfully.`;
    }
  }

  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}

function resolveTemplateKey(sessionsRemaining: number | null, endDate: string): WhatsAppTemplateKey {
  if (sessionsRemaining === 0) return "sessions_finished_reminder";
  if (sessionsRemaining !== null && sessionsRemaining > 0) return "low_sessions_reminder";
  if (endDate) return "expiry_reminder";
  return "renewal_confirmation";
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
  const [templates, setTemplates] = React.useState<WhatsAppTemplates>({});

  React.useEffect(() => {
    void fetch("/api/whatsapp/templates")
      .then((response) => response.json())
      .then((payload) => setTemplates(payload?.data?.templates ?? {}))
      .catch(() => undefined);
  }, []);

  if (!phone) {
    return null;
  }

  const links = Object.fromEntries(
    whatsappTemplateKeys.map((key) => [key, buildWhatsAppLink(phone, data, templates, "ar", key)]),
  ) as Record<WhatsAppTemplateKey, string>;

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
      <DropdownMenuContent align="end" className="min-w-56">
        {(
          [
            ["subscription_confirmation", "Subscription confirmation"],
            ["renewal_confirmation", "Renewal confirmation"],
            ["expiry_reminder", "Expiry reminder"],
            ["low_sessions_reminder", "Low sessions reminder"],
            ["sessions_finished_reminder", "Sessions finished"],
          ] as const
        ).map(([key, label]) => (
          <DropdownMenuItem
            key={key}
            render={
              <a href={links[key]} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} />
            }
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
