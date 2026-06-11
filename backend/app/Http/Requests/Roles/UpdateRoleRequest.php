<?php

namespace App\Http\Requests\Roles;

use App\Support\FoundationPermissions;
use Illuminate\Foundation\Http\FormRequest;
use Spatie\Permission\Models\Role;

class UpdateRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        $role = $this->route('role');

        return $this->user()->can('update', is_object($role) ? $role : Role::findOrFail($role));
    }

    public function rules(): array
    {
        $role = $this->route('role');
        $roleId = is_object($role) ? $role->id : $role;

        return [
            'name' => ['required', 'string', 'max:255', "unique:roles,name,{$roleId}"],
            'permissions' => ['nullable', 'array'],
            'permissions.*' => ['required', 'string', 'exists:permissions,name'],
        ];
    }

    public function withValidator($validator): void
    {
        $role = $this->route('role');
        $roleModel = is_object($role) ? $role : Role::find($role);

        if ($roleModel && in_array($roleModel->name, FoundationPermissions::ALL_ROLES, true)) {
            $validator->after(function ($validator): void {
                $validator->errors()->add('name', 'Preset roles cannot be updated.');
            });
        }
    }
}
