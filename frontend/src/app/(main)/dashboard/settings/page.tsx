import { MapPinned, MessageCircle, SendHorizontal } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { defaultWhatsAppTemplates, whatsappTemplateKeys } from "@/lib/whatsapp-templates";

import { saveWhatsAppAutomation, saveWhatsAppTemplates, updateSettings } from "./_components/actions";
import { getSettingsPageData } from "./_components/data";
import { GymLocationMap } from "./_components/gym-location-map";
import { SettingsActionForm } from "./_components/settings-action-form";
import { WhatsAppConnectionCard } from "./_components/whatsapp-connection-card";

export default async function Page() {
  const t = await getTranslations("Dashboard.settings");
  const { settings } = await getSettingsPageData();
  const gpsReady =
    settings.attendance.gym_latitude !== null &&
    settings.attendance.gym_longitude !== null &&
    settings.attendance.gym_radius_meters > 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>
        <Badge variant="outline" className={gpsReady ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>
          <MapPinned />
          {gpsReady ? t("gpsReady") : t("gpsMissing")}
        </Badge>
      </div>

      <SettingsActionForm action={updateSettings} className="grid grid-cols-1 gap-4">
        <Card className="overflow-visible">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-normal">
              <MapPinned className="size-4" />
              {t("attendanceGps")}
            </CardTitle>
            <CardDescription>{t("attendanceGpsDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 overflow-visible">
            <GymLocationMap
              latitude={settings.attendance.gym_latitude}
              longitude={settings.attendance.gym_longitude}
              radiusMeters={settings.attendance.gym_radius_meters}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("reminderDays")}
                name="reminder_days"
                type="text"
                defaultValue={settings.reminder_days.join(",")}
                placeholder={t("reminderDaysPlaceholder")}
                hint={t("reminderDaysHint")}
              />
            </div>

            <div className="grid gap-3 rounded-lg border p-3">
              <div>
                <p className="font-medium text-sm">{t("shiftHandoverSettings")}</p>
                <p className="text-muted-foreground text-xs">{t("shiftHandoverSettingsHelp")}</p>
              </div>
              <div className="grid gap-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="shifts.require_cash_count"
                    name="shifts.require_cash_count"
                    defaultChecked={settings.shifts?.require_cash_count ?? false}
                  />
                  <div className="grid gap-0.5">
                    <Label htmlFor="shifts.require_cash_count">{t("shiftRequireCashCount")}</Label>
                    <p className="text-muted-foreground text-xs">{t("shiftRequireCashCountHelp")}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="shifts.handover_auto_accept"
                    name="shifts.handover_auto_accept"
                    defaultChecked={settings.shifts?.handover_auto_accept ?? false}
                  />
                  <Label htmlFor="shifts.handover_auto_accept">{t("handoverAutoAccept")}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="shifts.handover_auto_accept_on_match_only"
                    name="shifts.handover_auto_accept_on_match_only"
                    defaultChecked={settings.shifts?.handover_auto_accept_on_match_only ?? true}
                  />
                  <Label htmlFor="shifts.handover_auto_accept_on_match_only">{t("handoverAutoAcceptMatchOnly")}</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="shifts.require_handover_to_open"
                    name="shifts.require_handover_to_open"
                    defaultChecked={settings.shifts?.require_handover_to_open ?? false}
                  />
                  <Label htmlFor="shifts.require_handover_to_open">{t("requireHandoverToOpen")}</Label>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={t("resetAfterClosedHours")}
                  name="shifts.reset_after_closed_hours"
                  type="number"
                  step="1"
                  defaultValue={settings.shifts?.reset_after_closed_hours ?? 4}
                  hint={t("resetAfterClosedHoursHint")}
                />
                <Field
                  label={t("dayStartsAtHour")}
                  name="shifts.day_starts_at_hour"
                  type="number"
                  step="1"
                  defaultValue={settings.shifts?.day_starts_at_hour ?? 5}
                  hint={t("dayStartsAtHourHint")}
                />
              </div>
            </div>

            <Button type="submit" className="w-full">
              {t("saveSettings")}
            </Button>
          </CardContent>
        </Card>
      </SettingsActionForm>
      <WhatsAppConnectionCard />
      <SettingsActionForm action={saveWhatsAppAutomation} className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-normal">
              <SendHorizontal className="size-4" /> Automatic sending
            </CardTitle>
            <CardDescription>
              Pick which messages go out on their own. Anything left off still works the old way — staff open WhatsApp
              from the member and press send. Each member gets a given message once.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center gap-2 rounded-md border bg-background p-3">
              <Checkbox
                id="whatsapp.auto_send"
                name="whatsapp.auto_send"
                defaultChecked={settings.whatsapp.auto_send}
              />
              <Label htmlFor="whatsapp.auto_send">Send member messages automatically</Label>
            </div>
            <div className="grid gap-3">
              {whatsappTemplateKeys.map((key) => (
                <div key={key} className="flex items-start gap-2 rounded-md border bg-background p-3">
                  <Checkbox
                    id={`whatsapp.auto_events.${key}`}
                    name={`whatsapp.auto_events.${key}`}
                    defaultChecked={settings.whatsapp.auto_events[key] ?? false}
                  />
                  <div className="grid gap-0.5">
                    <Label htmlFor={`whatsapp.auto_events.${key}`}>{formatTemplateLabel(key)}</Label>
                    <p className="text-muted-foreground text-xs">{whatsappEventHelp[key]}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button type="submit" className="w-full">
              Save automatic sending
            </Button>
          </CardContent>
        </Card>
      </SettingsActionForm>
      <SettingsActionForm action={saveWhatsAppTemplates} className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-normal">
              <MessageCircle className="size-4" /> WhatsApp message templates
            </CardTitle>
            <CardDescription>
              Edit every member message. Available placeholders: {"{{member_name}}"}, {"{{plan_name}}"},{" "}
              {"{{start_date}}"}, {"{{end_date}}"}, {"{{amount_paid}}"}, {"{{sessions_remaining}}"}, {"{{barcode_url}}"}
              .
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {whatsappTemplateKeys.map((key) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`whatsapp.${key}`}>{formatTemplateLabel(key)}</Label>
                <Textarea
                  id={`whatsapp.${key}`}
                  name={`whatsapp.${key}`}
                  defaultValue={settings.whatsapp.templates[key] ?? defaultWhatsAppTemplates[key]}
                  className="min-h-36 font-mono text-xs"
                  dir="auto"
                />
              </div>
            ))}
            <Button type="submit" className="w-full">
              Save WhatsApp templates
            </Button>
          </CardContent>
        </Card>
      </SettingsActionForm>
    </div>
  );
}

function formatTemplateLabel(key: string) {
  return key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/** When each automatic message fires, in the terms staff think about. */
const whatsappEventHelp: Record<(typeof whatsappTemplateKeys)[number], string> = {
  subscription_confirmation: "The moment a member is put on their first plan. Includes their entry barcode.",
  renewal_confirmation: "The moment an existing member is put on another plan.",
  expiry_reminder: "Once, when their subscription is close to its end date.",
  low_sessions_reminder: "Once, on the check-in that leaves them 2 sessions or fewer.",
  sessions_finished_reminder: "Once, on the check-in that uses their last session.",
};

function Field({
  defaultValue,
  hint,
  label,
  name,
  placeholder,
  step,
  type = "text",
}: {
  defaultValue: number | string;
  hint?: string;
  label: string;
  name: string;
  placeholder?: string;
  step?: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} step={step} defaultValue={defaultValue} placeholder={placeholder} />
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}
