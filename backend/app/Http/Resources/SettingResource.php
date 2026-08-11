<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use App\Support\WhatsAppTemplates;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SettingResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        $settings = $this->resource;
        $reminderDays = $this->normalizeReminderDays($settings['reminder_days'] ?? [7]);

        $gymColors = $settings['gym.colors'] ?? [
            'primary' => '#000000',
            'secondary' => '#ffffff',
        ];

        return [
            'gym' => [
                'name' => $settings['gym.name'] ?? 'ATP Gym',
                'colors' => [
                    'primary' => $gymColors['primary'] ?? '#000000',
                    'secondary' => $gymColors['secondary'] ?? '#ffffff',
                ],
                'logo' => $settings['gym.logo'] ?? null,
            ],
            'reminder_days' => $reminderDays,
            'currency' => $settings['currency'] ?? 'EGP',
            'vat_rate' => isset($settings['vat_rate']) ? (float) $settings['vat_rate'] : 14.0,
            'receipt_template' => $settings['receipt_template'] ?? 'default',
            'attendance' => [
                'gym_latitude' => isset($settings['attendance.gym_latitude']) ? (float) $settings['attendance.gym_latitude'] : null,
                'gym_longitude' => isset($settings['attendance.gym_longitude']) ? (float) $settings['attendance.gym_longitude'] : null,
                'gym_radius_meters' => isset($settings['attendance.gym_radius_meters']) ? (int) $settings['attendance.gym_radius_meters'] : 150,
            ],
            'shifts' => [
                // Defaults describe a desk that is driven by hand: nothing opens on a
                // schedule, and nothing stands between an employee and starting their
                // shift. Both can be switched back on from Settings.
                'require_cash_count' => (bool) ($settings['shifts.require_cash_count'] ?? false),
                'handover_auto_accept' => (bool) ($settings['shifts.handover_auto_accept'] ?? false),
                'handover_auto_accept_on_match_only' => (bool) ($settings['shifts.handover_auto_accept_on_match_only'] ?? true),
                'require_handover_to_open' => (bool) ($settings['shifts.require_handover_to_open'] ?? false),
            ],
            'whatsapp' => [
                'templates' => $settings['whatsapp.templates'] ?? [],
                'auto_send' => (bool) ($settings['whatsapp.auto_send'] ?? false),
                'auto_events' => $this->normalizeAutoEvents($settings['whatsapp.auto_events'] ?? []),
            ],
        ];
    }

    /**
     * Every known event, always present, always boolean.
     *
     * The settings table only holds keys the gym has touched, but the toggles
     * UI needs the full set — and an absent key means off, which is the safe
     * default for anything that messages real members.
     *
     * @return array<string, bool>
     */
    private function normalizeAutoEvents(mixed $stored): array
    {
        $stored = is_array($stored) ? $stored : [];
        $events = [];

        foreach (WhatsAppTemplates::keys() as $key) {
            $events[$key] = (bool) ($stored[$key] ?? false);
        }

        return $events;
    }

    /**
     * @return array<int, int>
     */
    private function normalizeReminderDays(mixed $value): array
    {
        if (is_int($value) || is_numeric($value)) {
            return [(int) $value];
        }

        if (is_string($value)) {
            $value = explode(',', $value);
        }

        if (! is_array($value)) {
            return [7];
        }

        $days = collect($value)
            ->map(static fn ($day): int => (int) $day)
            ->filter(static fn (int $day): bool => $day >= 0)
            ->unique()
            ->sortDesc()
            ->values()
            ->all();

        return $days !== [] ? $days : [7];
    }
}
