export const whatsappTemplateKeys = [
  "subscription_confirmation",
  "renewal_confirmation",
  "expiry_reminder",
  "low_sessions_reminder",
  "sessions_finished_reminder",
] as const;

export type WhatsAppTemplateKey = (typeof whatsappTemplateKeys)[number];
export type WhatsAppTemplates = Partial<Record<WhatsAppTemplateKey, string>>;

export const defaultWhatsAppTemplates: Record<WhatsAppTemplateKey, string> = {
  subscription_confirmation: `اهلا بيك يا {{member_name}}
تاريخ بداية اشتراكك: {{start_date}}
تاريخ نهاية اشتراكك: {{end_date}}
المبلغ المدفوع: {{amount_paid}}

لينك الباركود للدخول:
{{barcode_url}}

تنبيهات:
(1) يرجى الالتزام بمواعيد الدخول المعلنة.
(2) الجمعة من كل أسبوع إجازة رسمية في الجيم.
(3) ممنوع دخول الصالة بالحذاء العادي، ويرجى إحضار حذاء خاص بالتمرين.
(4) الجيم غير مسئول عن أي متعلقات شخصية.

Facebook: https://www.facebook.com/ATPGYMdamanhour
Instagram: https://www.instagram.com/atp_gym_damanhour?igsh=N3dicXg5Ynk5NThi`,
  renewal_confirmation: `أهلاً {{member_name}} 👋
تم تجديد اشتراكك في {{plan_name}} بنجاح.
تاريخ البداية: {{start_date}}
تاريخ النهاية: {{end_date}}
المبلغ المدفوع: {{amount_paid}}

باركود الدخول:
{{barcode_url}}`,
  expiry_reminder: `أهلاً {{member_name}} 👋
نذكرك أن اشتراكك في {{plan_name}} ينتهي في {{end_date}}.
يسعدنا تجديد اشتراكك قبل انتهاء المدة.`,
  low_sessions_reminder: `أهلاً {{member_name}} 👋
متبقي لك {{sessions_remaining}} حصة في اشتراك {{plan_name}}.
يسعدنا مساعدتك في التجديد أو حجز الحصص القادمة.`,
  sessions_finished_reminder: `أهلاً {{member_name}} 👋
انتهت جميع الحصص الخاصة باشتراك {{plan_name}}.
يسعدنا مساعدتك في التجديد وحجز الحصص القادمة.`,
};

export function renderWhatsAppTemplate(template: string, values: Record<string, string | number | null | undefined>) {
  return template.replace(/{{\s*([a-z_]+)\s*}}/gi, (_match, key: string) => String(values[key] ?? ""));
}
