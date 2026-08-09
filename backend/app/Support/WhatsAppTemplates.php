<?php

namespace App\Support;

/**
 * The member-facing WhatsApp message bodies.
 *
 * These defaults are a port of the frontend's lib/whatsapp-templates.ts and must
 * stay identical to it: staff still send some messages by hand from the
 * dashboard, and a member should not be able to tell which route a message took.
 * Anything the gym edits in Settings -> WhatsApp is stored under the
 * `whatsapp.templates` setting and overrides the matching default for both
 * routes.
 */
final class WhatsAppTemplates
{
    public const SUBSCRIPTION_CONFIRMATION = 'subscription_confirmation';

    public const RENEWAL_CONFIRMATION = 'renewal_confirmation';

    public const EXPIRY_REMINDER = 'expiry_reminder';

    public const LOW_SESSIONS_REMINDER = 'low_sessions_reminder';

    public const SESSIONS_FINISHED_REMINDER = 'sessions_finished_reminder';

    /** @return list<string> */
    public static function keys(): array
    {
        return [
            self::SUBSCRIPTION_CONFIRMATION,
            self::RENEWAL_CONFIRMATION,
            self::EXPIRY_REMINDER,
            self::LOW_SESSIONS_REMINDER,
            self::SESSIONS_FINISHED_REMINDER,
        ];
    }

    /** @return array<string, string> */
    public static function defaults(): array
    {
        return [
            self::SUBSCRIPTION_CONFIRMATION => <<<'TXT'
                اهلا بيك يا {{member_name}}
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
                Instagram: https://www.instagram.com/atp_gym_damanhour?igsh=N3dicXg5Ynk5NThi
                TXT,
            self::RENEWAL_CONFIRMATION => <<<'TXT'
                أهلاً {{member_name}} 👋
                تم تجديد اشتراكك في {{plan_name}} بنجاح.
                تاريخ البداية: {{start_date}}
                تاريخ النهاية: {{end_date}}
                المبلغ المدفوع: {{amount_paid}}

                باركود الدخول:
                {{barcode_url}}
                TXT,
            self::EXPIRY_REMINDER => <<<'TXT'
                أهلاً {{member_name}} 👋
                نذكرك أن اشتراكك في {{plan_name}} ينتهي في {{end_date}}.
                يسعدنا تجديد اشتراكك قبل انتهاء المدة.
                TXT,
            self::LOW_SESSIONS_REMINDER => <<<'TXT'
                أهلاً {{member_name}} 👋
                متبقي لك {{sessions_remaining}} حصة في اشتراك {{plan_name}}.
                يسعدنا مساعدتك في التجديد أو حجز الحصص القادمة.
                TXT,
            self::SESSIONS_FINISHED_REMINDER => <<<'TXT'
                أهلاً {{member_name}} 👋
                انتهت جميع الحصص الخاصة باشتراك {{plan_name}}.
                يسعدنا مساعدتك في التجديد وحجز الحصص القادمة.
                TXT,
        ];
    }

    /**
     * The body for a template key, preferring the gym's edited version.
     *
     * @param  array<string, mixed>  $overrides  The stored `whatsapp.templates` setting.
     */
    public static function body(string $key, array $overrides = []): ?string
    {
        $override = $overrides[$key] ?? null;

        if (is_string($override) && trim($override) !== '') {
            return $override;
        }

        return self::defaults()[$key] ?? null;
    }

    /**
     * Substitute {{placeholders}}.
     *
     * Mirrors renderWhatsAppTemplate() in the frontend, including its treatment
     * of an unknown or null value as an empty string rather than leaving the
     * raw placeholder in a member-facing message.
     *
     * @param  array<string, mixed>  $values
     */
    public static function render(string $template, array $values): string
    {
        return preg_replace_callback(
            '/\{\{\s*([a-z_]+)\s*\}\}/i',
            static fn (array $matches): string => (string) ($values[strtolower($matches[1])] ?? ''),
            $template,
        ) ?? $template;
    }

    /**
     * Hosted Code128 image for an attendance code.
     *
     * Port of buildBarcodeImageUrl() in the frontend: Code128 rather than QR
     * because the gym's laser scanners cannot read a 2D symbol, and the bare
     * code rather than the "member:" payload because the prefix makes the symbol
     * ~55% wider for no benefit.
     */
    public static function barcodeImageUrl(?string $code): ?string
    {
        $value = preg_replace('/^(member|employee):/i', '', trim((string) $code)) ?? '';

        if ($value === '') {
            return null;
        }

        return 'https://barcodeapi.org/api/128/'.rawurlencode($value);
    }
}
