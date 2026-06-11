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
            $normalized['reminder_days'] = $this->input('reminder_days');
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
            'reminder_days' => ['nullable', 'integer', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3', 'regex:/^[A-Z]{3}$/'],
            'vat_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'receipt_template' => ['nullable', 'string', 'max:1000'],
        ];

        if ($this->hasFile('gym.logo')) {
            $rules['gym.logo'] = ['nullable', 'file', 'mimes:jpg,jpeg,png,webp', 'max:2048'];
        } else {
            $rules['gym.logo'] = ['nullable', 'string'];
        }

        return $rules;
    }
}
