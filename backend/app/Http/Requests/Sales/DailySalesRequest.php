<?php

namespace App\Http\Requests\Sales;

use App\Support\PosPermissions;
use Illuminate\Foundation\Http\FormRequest;

class DailySalesRequest extends FormRequest
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
            'date' => ['sometimes', 'date_format:Y-m-d'],
        ];
    }
}
