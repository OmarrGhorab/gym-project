<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\EmployeeAbsences\DeleteEmployeeAbsence;
use App\Actions\EmployeeAbsences\StoreEmployeeAbsence;
use App\Actions\EmployeeAbsences\UpdateEmployeeAbsence;
use App\Http\Requests\EmployeeAbsences\StoreEmployeeAbsenceRequest;
use App\Http\Requests\EmployeeAbsences\UpdateEmployeeAbsenceRequest;
use App\Http\Resources\EmployeeAbsenceResource;
use App\Models\Attendance;
use App\Models\Employee;
use App\Models\Payroll;
use App\Support\HrFinancePermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;

final class EmployeeAbsenceController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $request->user()->hasPermissionTo(HrFinancePermissions::PERM_PAYROLL_GENERATE) || abort(403);

        $validated = $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
        ]);
        $month = $validated['month'] ?? now()->format('Y-m');
        $from = "{$month}-01";
        $to = Carbon::parse($from)->endOfMonth()->toDateString();

        $employees = Employee::query()
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->orderBy('name')
            ->get(['id', 'name', 'role', 'status']);

        $payrollStatuses = Payroll::query()
            ->whereIn('employee_id', $employees->modelKeys())
            ->where('month', $month)
            ->pluck('status', 'employee_id');

        $absences = Attendance::query()
            ->with(['employee:id,name,role,status', 'absenceRecorder:id,name'])
            ->where('status', 'absent')
            ->whereBetween('date', [$from, $to])
            ->orderByDesc('date')
            ->orderByDesc('id')
            ->get();

        return $this->success(
            data: [
                'month' => $month,
                'employees' => $employees->map(fn (Employee $employee): array => [
                    'id' => $employee->id,
                    'name' => $employee->name,
                    'role' => $employee->role,
                    'status' => $employee->status,
                    'payroll_status' => $payrollStatuses->get($employee->id),
                ])->values()->all(),
                'absences' => EmployeeAbsenceResource::collection($absences)->resolve(),
            ],
            message: 'Employee absences retrieved',
        );
    }

    public function store(StoreEmployeeAbsenceRequest $request, StoreEmployeeAbsence $action): JsonResponse
    {
        $absence = $action->handle($request->validated(), $request->user());

        return (new EmployeeAbsenceResource($absence))
            ->withMessage('Employee absence recorded')
            ->response()
            ->setStatusCode(201);
    }

    public function update(
        UpdateEmployeeAbsenceRequest $request,
        Attendance $absence,
        UpdateEmployeeAbsence $action,
    ): JsonResponse {
        $absence = $action->handle($absence, $request->validated(), $request->user());

        return (new EmployeeAbsenceResource($absence))
            ->withMessage('Employee absence updated')
            ->response()
            ->setStatusCode(200);
    }

    public function destroy(Request $request, Attendance $absence, DeleteEmployeeAbsence $action): JsonResponse
    {
        $request->user()->hasPermissionTo(HrFinancePermissions::PERM_PAYROLL_GENERATE) || abort(403);
        abort_unless($absence->status === 'absent', 404);

        $isPaid = Payroll::query()
            ->where('employee_id', $absence->employee_id)
            ->where('month', $absence->date?->format('Y-m'))
            ->where('status', 'paid')
            ->exists();

        if ($isPaid) {
            throw ValidationException::withMessages([
                'absence' => 'Paid payroll absences are locked and cannot be deleted.',
            ]);
        }

        $action->handle($absence);

        return response()->json(null, 204);
    }
}
