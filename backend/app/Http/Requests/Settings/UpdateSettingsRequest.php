<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('settings.manage');
    }

    protected function prepareForValidation(): void
    {
        $gym = [];

        // 1. gym.name
        if ($this->has('gym.name')) {
            $gym['name'] = $this->input('gym.name');
        } elseif ($this->has('gym_name')) {
            $gym['name'] = $this->input('gym_name');
        } elseif ($this->has('gym') && is_array($this->input('gym')) && isset($this->input('gym')['name'])) {
            $gym['name'] = $this->input('gym')['name'];
        }

        // 2. gym.colors
        if ($this->has('gym.colors')) {
            $gym['colors'] = $this->input('gym.colors');
        } elseif ($this->has('gym_colors')) {
            $gym['colors'] = $this->input('gym_colors');
        } elseif ($this->has('gym') && is_array($this->input('gym')) && isset($this->input('gym')['colors'])) {
            $gym['colors'] = $this->input('gym')['colors'];
        }

        // 3. gym.logo
        if ($this->hasFile('gym.logo') || $this->has('gym.logo')) {
            $gym['logo'] = $this->file('gym.logo') ?: $this->input('gym.logo');
        } elseif ($this->hasFile('gym_logo') || $this->has('gym_logo')) {
            $gym['logo'] = $this->file('gym_logo') ?: $this->input('gym_logo');
        } elseif ($this->has('gym') && is_array($this->input('gym')) && isset($this->input('gym')['logo'])) {
            $gym['logo'] = $this->input('gym')['logo'];
        }

        $normalized = [];
        if (! empty($gym)) {
            $normalized['gym'] = $gym;
        }

        // 4. reminder_days
        if ($this->has('reminder_days')) {
            $reminderDays = $this->input('reminder_days');

            if (is_string($reminderDays)) {
                $reminderDays = array_values(array_filter(array_map(
                    static fn (string $value): string => trim($value),
                    explode(',', $reminderDays),
                ), static fn (string $value): bool => $value !== ''));
            }

            $normalized['reminder_days'] = $reminderDays;
        }

        // 5. currency
        if ($this->has('currency')) {
            $normalized['currency'] = $this->input('currency');
        }

        // 6. vat_rate
        if ($this->has('vat_rate')) {
            $normalized['vat_rate'] = $this->input('vat_rate');
        }

        // 7. receipt_template
        if ($this->has('receipt_template')) {
            $normalized['receipt_template'] = $this->input('receipt_template');
        }

        // 8. payroll scheduling
        $payroll = [];
        if ($this->has('payroll.schedule_mode')) {
            $payroll['schedule_mode'] = $this->input('payroll.schedule_mode');
        } elseif ($this->has('payroll_schedule_mode')) {
            $payroll['schedule_mode'] = $this->input('payroll_schedule_mode');
        } elseif ($this->has('payroll') && is_array($this->input('payroll')) && array_key_exists('schedule_mode', $this->input('payroll'))) {
            $payroll['schedule_mode'] = $this->input('payroll')['schedule_mode'];
        }

        if ($this->has('payroll.default_pay_day')) {
            $payroll['default_pay_day'] = $this->input('payroll.default_pay_day');
        } elseif ($this->has('payroll_default_pay_day')) {
            $payroll['default_pay_day'] = $this->input('payroll_default_pay_day');
        } elseif ($this->has('payroll') && is_array($this->input('payroll')) && array_key_exists('default_pay_day', $this->input('payroll'))) {
            $payroll['default_pay_day'] = $this->input('payroll')['default_pay_day'];
        }

        if (! empty($payroll)) {
            $normalized['payroll'] = $payroll;
        }

        // 9. attendance geofence/settings
        $attendance = [];
        if ($this->has('attendance.gym_latitude')) {
            $attendance['gym_latitude'] = $this->input('attendance.gym_latitude');
        } elseif ($this->has('attendance_gym_latitude')) {
            $attendance['gym_latitude'] = $this->input('attendance_gym_latitude');
        } elseif ($this->has('attendance') && is_array($this->input('attendance')) && array_key_exists('gym_latitude', $this->input('attendance'))) {
            $attendance['gym_latitude'] = $this->input('attendance')['gym_latitude'];
        }

        if ($this->has('attendance.gym_longitude')) {
            $attendance['gym_longitude'] = $this->input('attendance.gym_longitude');
        } elseif ($this->has('attendance_gym_longitude')) {
            $attendance['gym_longitude'] = $this->input('attendance_gym_longitude');
        } elseif ($this->has('attendance') && is_array($this->input('attendance')) && array_key_exists('gym_longitude', $this->input('attendance'))) {
            $attendance['gym_longitude'] = $this->input('attendance')['gym_longitude'];
        }

        if ($this->has('attendance.gym_radius_meters')) {
            $attendance['gym_radius_meters'] = $this->input('attendance.gym_radius_meters');
        } elseif ($this->has('attendance_gym_radius_meters')) {
            $attendance['gym_radius_meters'] = $this->input('attendance_gym_radius_meters');
        } elseif ($this->has('attendance') && is_array($this->input('attendance')) && array_key_exists('gym_radius_meters', $this->input('attendance'))) {
            $attendance['gym_radius_meters'] = $this->input('attendance')['gym_radius_meters'];
        }

        if ($this->has('attendance.default_grace_minutes')) {
            $attendance['default_grace_minutes'] = $this->input('attendance.default_grace_minutes');
        } elseif ($this->has('attendance_default_grace_minutes')) {
            $attendance['default_grace_minutes'] = $this->input('attendance_default_grace_minutes');
        } elseif ($this->has('attendance') && is_array($this->input('attendance')) && array_key_exists('default_grace_minutes', $this->input('attendance'))) {
            $attendance['default_grace_minutes'] = $this->input('attendance')['default_grace_minutes'];
        }

        if (! empty($attendance)) {
            $normalized['attendance'] = $attendance;
        }

        // 10. shift handover settings
        $shifts = [];
        if ($this->has('shifts') && is_array($this->input('shifts'))) {
            $shifts = array_intersect_key($this->input('shifts'), array_flip([
                'handover_auto_accept',
                'handover_auto_accept_on_match_only',
                'require_handover_to_open',
            ]));
        }
        foreach ([
            'handover_auto_accept' => 'shifts.handover_auto_accept',
            'handover_auto_accept_on_match_only' => 'shifts.handover_auto_accept_on_match_only',
            'require_handover_to_open' => 'shifts.require_handover_to_open',
        ] as $nested => $flatKey) {
            if ($this->has($flatKey)) {
                $shifts[$nested] = $this->boolean($flatKey);
            }
        }
        if (! empty($shifts)) {
            $normalized['shifts'] = $shifts;
        }

        $this->replace($normalized);
    }

    public function rules(): array
    {
        $rules = [
            'gym.name' => ['nullable', 'string', 'max:255'],
            'gym.colors' => ['nullable', 'array'],
            'gym.colors.primary' => ['nullable', 'string', 'regex:/^#([a-fA-F0-9]{3}){1,2}$/'],
            'gym.colors.secondary' => ['nullable', 'string', 'regex:/^#([a-fA-F0-9]{3}){1,2}$/'],
            'gym.colors.accent' => ['nullable', 'string', 'regex:/^#([a-fA-F0-9]{3}){1,2}$/'],
            'reminder_days' => ['nullable', 'array'],
            'reminder_days.*' => ['integer', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3', 'regex:/^[A-Z]{3}$/'],
            'vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'receipt_template' => ['nullable', 'string', 'max:1000'],
            'payroll' => ['nullable', 'array'],
            'payroll.schedule_mode' => ['nullable', 'string', 'in:fixed,per_employee'],
            'payroll.default_pay_day' => ['nullable', 'integer', 'min:1', 'max:31'],
            'attendance' => ['nullable', 'array'],
            'attendance.gym_latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'attendance.gym_longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'attendance.gym_radius_meters' => ['nullable', 'integer', 'min:10', 'max:10000'],
            'attendance.default_grace_minutes' => ['nullable', 'integer', 'min:0', 'max:240'],
            'shifts' => ['nullable', 'array'],
            'shifts.handover_auto_accept' => ['nullable', 'boolean'],
            'shifts.handover_auto_accept_on_match_only' => ['nullable', 'boolean'],
            'shifts.require_handover_to_open' => ['nullable', 'boolean'],
        ];

        if ($this->hasFile('gym.logo')) {
            $rules['gym.logo'] = ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:2048'];
        } else {
            $rules['gym.logo'] = ['nullable', 'string'];
        }

        return $rules;
    }
}
