<?php

namespace App\Http\Requests\EmployeePlanCommissionRules;

use App\Models\Employee;
use App\Models\EmployeePlanCommissionRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateEmployeePlanCommissionRuleRequest extends FormRequest
{
    public function authorize(): bool
    {
        $employee = $this->route('employee');

        return $employee instanceof Employee
            ? $this->user()->can('update', $employee)
            : false;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        /** @var Employee $employee */
        $employee = $this->route('employee');
        /** @var EmployeePlanCommissionRule $rule */
        $rule = $this->route('employeePlanCommissionRule');

        return [
            'plan_id' => [
                'nullable',
                'integer',
                'exists:plans,id',
                Rule::unique(EmployeePlanCommissionRule::class, 'plan_id')
                    ->ignore($rule->id)
                    ->where(fn ($query) => $query->where('employee_id', $employee->id)),
                function (string $attribute, mixed $value, \Closure $fail) use ($employee, $rule): void {
                    if (
                        $value === null
                        && $employee->planCommissionRules()
                            ->whereKeyNot($rule->id)
                            ->whereNull('plan_id')
                            ->exists()
                    ) {
                        $fail('A default commission rule already exists for this employee.');
                    }
                },
            ],
            'calculation_type' => ['required', 'string', Rule::in(['fixed', 'percentage'])],
            'value' => ['required', 'numeric', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
