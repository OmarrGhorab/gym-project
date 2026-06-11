<?php

namespace App\Http\Requests\Dashboard;

use App\Support\PosPermissions;
use Illuminate\Foundation\Http\FormRequest;

class TopProductsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can(PosPermissions::PERM_REPORTS_VIEW);
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'limit' => ['sometimes', 'integer', 'between:1,20'],
            'period' => ['sometimes', 'string', 'in:today,week,month'],
        ];
    }
}
