<?php

namespace App\Actions\Settings;

use App\Actions\Payroll\GeneratePayroll;
use App\Models\Payroll;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Support\Facades\Cache;

final class UpdateSettings
{
    public function __construct(
        private readonly StoreSetting $store,
        private readonly GeneratePayroll $generatePayroll,
    ) {}

    /**
     * Persist all provided settings and log the change.
     *
     * Accepts validated input with nested keys and an optional pre-resolved
     * logo path from the controller layer. Flattening of nested keys into
     * dot-notation is handled here so controllers stay thin.
     *
     * @param  array<string, mixed>  $validated  Raw validated request data.
     * @return array<string, mixed> Fresh key → value snapshot after update.
     */
    public function handle(array $validated, User $user, ?string $logoPath = null): array
    {
        $flatSettings = $this->flatten($validated, $logoPath);

        foreach ($flatSettings as $key => $value) {
            $this->store->execute($key, $value);
        }

        if ($this->updatesPayrollBonusRules($flatSettings)) {
            Payroll::query()
                ->where('status', 'pending')
                ->with('employee')
                ->each(fn (Payroll $payroll) => $this->generatePayroll->refreshPendingPayroll($payroll, $payroll->employee));
        }

        $fresh = Setting::all()->pluck('value', 'key')->toArray();
        Cache::forever('settings.all', $fresh);

        activity()
            ->causedBy($user)
            ->log('Updated system settings');

        return $fresh;
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return array<string, string>
     */
    private function flatten(array $validated, ?string $logoPath): array
    {
        $flat = [];

        if (isset($validated['gym'])) {
            if (array_key_exists('name', $validated['gym'])) {
                $flat['gym.name'] = $validated['gym']['name'];
            }
            if (array_key_exists('colors', $validated['gym'])) {
                $flat['gym.colors'] = $validated['gym']['colors'];
            }
            if ($logoPath !== null) {
                $flat['gym.logo'] = $logoPath;
            } elseif (array_key_exists('logo', $validated['gym'])) {
                $flat['gym.logo'] = $validated['gym']['logo'];
            }
        }

        foreach (['reminder_days', 'currency', 'vat_rate', 'receipt_template'] as $key) {
            if (array_key_exists($key, $validated)) {
                $flat[$key] = $validated[$key];
            }
        }

        if (isset($validated['payroll'])) {
            foreach ([
                'schedule_mode',
                'default_pay_day',
            ] as $key) {
                if (array_key_exists($key, $validated['payroll'])) {
                    $flat["payroll.{$key}"] = $validated['payroll'][$key];
                }
            }
        }

        if (isset($validated['shifts'])) {
            foreach (['require_cash_count', 'handover_auto_accept', 'handover_auto_accept_on_match_only', 'require_handover_to_open'] as $key) {
                if (array_key_exists($key, $validated['shifts'])) {
                    $flat["shifts.{$key}"] = $validated['shifts'][$key];
                }
            }
        }

        if (isset($validated['attendance'])) {
            foreach (['gym_latitude', 'gym_longitude', 'gym_radius_meters'] as $key) {
                if (array_key_exists($key, $validated['attendance'])) {
                    $flat["attendance.{$key}"] = $validated['attendance'][$key];
                }
            }
        }

        if (isset($validated['whatsapp'])) {
            foreach (['templates', 'auto_send', 'auto_events'] as $key) {
                if (array_key_exists($key, $validated['whatsapp'])) {
                    $flat["whatsapp.{$key}"] = $validated['whatsapp'][$key];
                }
            }
        }

        return $flat;
    }

    /** @param array<string, mixed> $flatSettings */
    private function updatesPayrollBonusRules(array $flatSettings): bool
    {
        return collect(array_keys($flatSettings))->contains(
            fn (string $key): bool => str_starts_with($key, 'payroll.')
                && str_contains($key, '_bonus_'),
        );
    }
}
