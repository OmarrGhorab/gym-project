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
                'name' => $settings['gym.name'] ?? 'Power Gym',
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
        ];
    }
}
