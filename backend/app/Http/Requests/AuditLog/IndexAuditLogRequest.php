<?php

namespace App\Http\Requests\AuditLog;

use App\Http\Resources\AuditLogResource;
use Illuminate\Foundation\Http\FormRequest;
use Spatie\Activitylog\Models\Activity;

class IndexAuditLogRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('viewAny', Activity::class);
    }

    public function rules(): array
    {
        return [
            'filter.from'    => ['nullable', 'date'],
            'filter.to'      => ['nullable', 'date', 'after_or_equal:filter.from'],
            'filter.subject' => ['nullable', 'string', function ($attribute, $value, $fail): void {
                if (! array_key_exists($value, AuditLogResource::$aliasMap)) {
                    $fail('The selected subject alias is invalid.');
                }
            }],
            'filter.causer'  => ['nullable', 'integer'],
            'sort'           => ['nullable', 'string', 'in:created_at,-created_at'],
        ];
    }
}
