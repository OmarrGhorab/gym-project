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
        ];
    }
}
