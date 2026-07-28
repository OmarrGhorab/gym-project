<?php

namespace App\Http\Requests\Users;

use Illuminate\Database\Query\Builder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

final class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->can('roles.manage');
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'confirmed', Password::defaults()],
            'roles' => ['required', 'array', 'min:1', 'max:20'],
            'roles.*' => ['required', 'string', 'distinct', 'exists:roles,name'],
            'employee_id' => [
                'nullable',
                'integer',
                Rule::exists('employees', 'id')->where(
                    fn (Builder $query): Builder => $query->whereNull('user_id')->whereNull('deleted_at')
                ),
            ],
        ];
    }
}
