<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class SettingResource extends JsonResource
{
    use WrapsApiResponse;

    public function toArray(Request $request): array
    {
        $settings = $this->resource;

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
            'reminder_days' => isset($settings['reminder_days']) ? (int) $settings['reminder_days'] : 7,
            'currency' => $settings['currency'] ?? 'EGP',
            'vat_rate' => isset($settings['vat_rate']) ? (float) $settings['vat_rate'] : 14.0,
            'receipt_template' => $settings['receipt_template'] ?? 'default',
            'payroll' => [
                'schedule_mode' => $settings['payroll.schedule_mode'] ?? 'fixed',
                'default_pay_day' => isset($settings['payroll.default_pay_day']) ? (int) $settings['payroll.default_pay_day'] : 30,
            ],
            'attendance' => [
                'gym_latitude' => isset($settings['attendance.gym_latitude']) ? (float) $settings['attendance.gym_latitude'] : null,
                'gym_longitude' => isset($settings['attendance.gym_longitude']) ? (float) $settings['attendance.gym_longitude'] : null,
                'gym_radius_meters' => isset($settings['attendance.gym_radius_meters']) ? (int) $settings['attendance.gym_radius_meters'] : 150,
                'default_grace_minutes' => isset($settings['attendance.default_grace_minutes']) ? (int) $settings['attendance.default_grace_minutes'] : 15,
            ],
        ];
    }
}
