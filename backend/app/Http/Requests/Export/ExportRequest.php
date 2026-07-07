<?php

namespace App\Http\Requests\Export;

use App\Support\SystemPermissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ExportRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Permission enforcement is handled by the route gate (can:export-resource,resource).
        return true;
    }

    protected function prepareForValidation(): void
    {
        // Merge the route parameter so it can be validated with rules().
        $this->merge(['resource' => $this->route('resource')]);
    }

    public function rules(): array
    {
        return [
            'resource' => ['required', 'string', Rule::in(array_keys(SystemPermissions::EXPORT_PERMISSION_MAP))],
            'format' => ['required', 'string', Rule::in(['xlsx', 'csv', 'pdf'])],
            'locale' => ['sometimes', 'string', Rule::in(['en', 'ar'])],
        ];
    }
}
