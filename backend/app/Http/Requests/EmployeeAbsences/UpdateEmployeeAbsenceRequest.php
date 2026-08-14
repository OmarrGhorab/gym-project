<?php

namespace App\Http\Requests\EmployeeAbsences;

use App\Models\Attendance;
use App\Models\Payroll;
use App\Support\HrFinancePermissions;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateEmployeeAbsenceRequest extends FormRequest
{
    public function authorize(): bool
    {
        $absence = $this->route('absence');

        return $absence instanceof Attendance
            && $absence->status === 'absent'
            && $this->user()->hasPermissionTo(HrFinancePermissions::PERM_PAYROLL_GENERATE);
    }

    public function rules(): array
    {
        return [
            'employee_id' => [
                'required',
                'integer',
                Rule::exists('employees', 'id')->whereNull('deleted_at'),
            ],
            'date' => ['required', 'date_format:Y-m-d', 'before_or_equal:today'],
            'reason' => ['required', 'string', 'max:500'],
            'deduction_amount' => ['nullable', 'numeric', 'min:0'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->hasAny(['employee_id', 'date'])) {
                    return;
                }

                /** @var Attendance $absence */
                $absence = $this->route('absence');
                $employeeId = (int) $this->input('employee_id');
                $date = (string) $this->input('date');

                if (Attendance::query()
                    ->where('employee_id', $employeeId)
                    ->whereDate('date', $date)
                    ->whereKeyNot($absence->id)
                    ->exists()) {
                    $validator->errors()->add('date', 'Attendance already exists for this employee and date.');
                }

                $lockedPeriods = [
                    [$employeeId, $date],
                    [(int) $absence->employee_id, $absence->date?->toDateString() ?? $date],
                ];

                foreach ($lockedPeriods as [$lockedEmployeeId, $lockedDate]) {
                    if ($this->hasPaidPayroll($lockedEmployeeId, $lockedDate)) {
                        $validator->errors()->add('date', 'Paid payroll absences are locked and cannot be changed.');

                        break;
                    }
                }
            },
        ];
    }

    private function hasPaidPayroll(int $employeeId, string $date): bool
    {
        return Payroll::query()
            ->where('employee_id', $employeeId)
            ->where('month', Carbon::parse($date)->format('Y-m'))
            ->where('status', 'paid')
            ->exists();
    }
}
