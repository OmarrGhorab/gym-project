<?php

namespace App\Http\Requests\Members;

use Illuminate\Foundation\Http\FormRequest;

class UploadMemberPhotoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('update', $this->route('member'));
    }

    public function rules(): array
    {
        return [
            'photo' => [
                'required',
                'file',
                'mimes:jpg,jpeg,png,webp',
                'max:5120',
            ],
        ];
    }
}
