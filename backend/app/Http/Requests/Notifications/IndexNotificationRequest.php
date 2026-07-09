<?php

namespace App\Http\Requests\Notifications;

use App\Support\MembershipPermissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexNotificationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can(MembershipPermissions::PERM_NOTIFICATIONS_VIEW);
    }

    public function rules(): array
    {
        return [
            'unread' => ['sometimes', Rule::in(['true', 'false', '1', '0', true, false, 1, 0])],
            'status' => ['nullable', Rule::in(['all', 'read', 'unread'])],
            'category' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
