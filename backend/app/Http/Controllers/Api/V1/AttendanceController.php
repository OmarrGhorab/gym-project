<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Attendance\CheckInEmployeeAttendance;
use App\Actions\Attendance\CheckOutEmployeeAttendance;
use App\Actions\Attendance\StoreAttendance;
use App\Actions\Attendance\UpdateAttendance;
use App\Http\Requests\Attendance\ReviewAttendanceViolationRequest;
use App\Http\Requests\Attendance\ScanAttendanceRequest;
use App\Http\Requests\Attendance\StoreAttendanceRequest;
use App\Http\Requests\Attendance\StoreAttendanceViolationRuleRequest;
use App\Http\Requests\Attendance\StoreEmployeeShiftRequest;
use App\Http\Requests\Attendance\UpdateAttendanceRequest;
use App\Http\Requests\Attendance\UpdateAttendanceViolationRuleRequest;
use App\Http\Requests\Attendance\UpdateEmployeeShiftRequest;
use App\Http\Resources\AttendanceResource;
use App\Http\Resources\AttendanceViolationResource;
use App\Http\Resources\AttendanceViolationRuleResource;
use App\Http\Resources\EmployeeShiftResource;
use App\Models\Attendance;
use App\Models\AttendanceViolation;
use App\Models\AttendanceViolationRule;
use App\Models\EmployeeShift;
use App\Services\OperationalNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

final class AttendanceController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Attendance::class);

        $attendance = QueryBuilder::for(Attendance::class)
            ->with(['employee.shift', 'shift'])
            ->allowedFilters(
                AllowedFilter::exact('employee_id'),
                AllowedFilter::exact('date'),
                AllowedFilter::exact('status'),
                AllowedFilter::callback('from', function ($query, $value): void {
                    $query->where('date', '>=', $value);
                }),
                AllowedFilter::callback('to', function ($query, $value): void {
                    $query->where('date', '<=', $value);
                })
            )
            ->allowedSorts('date', 'check_in', 'created_at')
            ->defaultSort('-date')
            ->paginate(15)
            ->withQueryString();

        return $this->success(
            data: AttendanceResource::collection($attendance->getCollection())->resolve(),
            message: 'Attendance retrieved',
            meta: [
                'current_page' => $attendance->currentPage(),
                'per_page' => $attendance->perPage(),
                'total' => $attendance->total(),
                'last_page' => $attendance->lastPage(),
            ],
        );
    }

    public function shifts(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Attendance::class);

        return $this->success(
            data: EmployeeShiftResource::collection(EmployeeShift::query()->where('is_active', true)->orderBy('starts_at')->get())->resolve(),
            message: 'Employee shifts retrieved',
        );
    }

    public function manageShifts(Request $request): JsonResponse
    {
        $request->user()->can('settings.manage') || abort(403);

        return $this->success(
            data: EmployeeShiftResource::collection(EmployeeShift::query()->orderBy('starts_at')->orderBy('name')->get())->resolve(),
            message: 'Employee shifts retrieved',
        );
    }

    public function storeShift(StoreEmployeeShiftRequest $request): JsonResponse
    {
        $shift = EmployeeShift::query()->create($request->validated());

        return (new EmployeeShiftResource($shift))
            ->withMessage('Employee shift created')
            ->response()
            ->setStatusCode(201);
    }

    public function updateShift(UpdateEmployeeShiftRequest $request, EmployeeShift $employeeShift): JsonResponse
    {
        $employeeShift->update($request->validated());

        return (new EmployeeShiftResource($employeeShift->fresh()))
            ->withMessage('Employee shift updated')
            ->response()
            ->setStatusCode(200);
    }

    public function deactivateShift(Request $request, EmployeeShift $employeeShift): JsonResponse
    {
        $request->user()->can('settings.manage') || abort(403);

        $employeeShift->update(['is_active' => false]);

        return (new EmployeeShiftResource($employeeShift->fresh()))
            ->withMessage('Employee shift deactivated')
            ->response()
            ->setStatusCode(200);
    }

    public function violations(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Attendance::class);

        $query = AttendanceViolation::query()
            ->with(['employee', 'rule'])
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->query('type'), fn ($query, $type) => $query->where('type', $type))
            ->when($request->query('employee_id'), fn ($query, $employeeId) => $query->where('employee_id', $employeeId))
            ->latest('violation_date');

        $violations = $query->paginate(15)->withQueryString();

        return $this->success(
            data: AttendanceViolationResource::collection($violations->getCollection())->resolve(),
            message: 'Attendance violations retrieved',
            meta: [
                'current_page' => $violations->currentPage(),
                'per_page' => $violations->perPage(),
                'total' => $violations->total(),
                'last_page' => $violations->lastPage(),
            ],
        );
    }

    public function violationRules(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Attendance::class);

        return $this->success(
            data: AttendanceViolationRuleResource::collection(
                AttendanceViolationRule::query()->orderBy('code')->get()
            )->resolve(),
            message: 'Attendance violation rules retrieved',
        );
    }

    public function updateViolationRule(
        UpdateAttendanceViolationRuleRequest $request,
        AttendanceViolationRule $attendanceViolationRule,
    ): JsonResponse {
        $attendanceViolationRule->update($request->validated());

        return (new AttendanceViolationRuleResource($attendanceViolationRule->fresh()))
            ->withMessage('Attendance violation rule updated')
            ->response()
            ->setStatusCode(200);
    }

    public function storeViolationRule(StoreAttendanceViolationRuleRequest $request): JsonResponse
    {
        $data = $request->validated();
        $code = Str::slug($data['name'], '_');

        $attendanceViolationRule = AttendanceViolationRule::query()->updateOrCreate(
            ['code' => $code],
            $data + ['code' => $code],
        );

        return (new AttendanceViolationRuleResource($attendanceViolationRule->fresh()))
            ->withMessage('Attendance violation rule created')
            ->response()
            ->setStatusCode(201);
    }

    public function reviewViolation(
        ReviewAttendanceViolationRequest $request,
        AttendanceViolation $attendanceViolation,
        OperationalNotifier $notifier,
    ): JsonResponse {
        $data = $request->validated();
        $deductionDays = $data['deduction_days'] ?? $attendanceViolation->deduction_days;
        $deductionAmount = $data['deduction_amount'] ?? $attendanceViolation->deduction_amount;
        $originalDeductionAmount = (string) $attendanceViolation->deduction_amount;
        $originalStatus = (string) $attendanceViolation->status;

        if (! array_key_exists('deduction_amount', $data) && $data['status'] === 'approved') {
            $attendanceViolation->loadMissing('employee');

            if ($attendanceViolation->employee?->base_salary !== null) {
                $dailySalary = bcdiv((string) $attendanceViolation->employee->base_salary, '30', 2);
                $deductionAmount = bcmul($dailySalary, (string) $deductionDays, 2);
            }
        }

        $attendanceViolation->update([
            'status' => $data['status'],
            'deduction_days' => $deductionDays,
            'deduction_amount' => $deductionAmount,
            'notes' => $data['notes'] ?? $attendanceViolation->notes,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        if (
            bccomp((string) $deductionAmount, '0.00', 2) === 1
            && ($originalStatus !== $data['status'] || bccomp($originalDeductionAmount, (string) $deductionAmount, 2) !== 0)
        ) {
            $reviewedViolation = $attendanceViolation->fresh(['employee.user', 'payroll']);

            if ($reviewedViolation instanceof AttendanceViolation) {
                $notifier->employeeAttendanceDeduction($reviewedViolation);
            }
        }

        return (new AttendanceViolationResource($attendanceViolation->fresh(['employee', 'rule'])))
            ->withMessage('Attendance violation reviewed')
            ->response()
            ->setStatusCode(200);
    }

    public function checkIn(ScanAttendanceRequest $request, CheckInEmployeeAttendance $action): JsonResponse
    {
        $attendance = $action->handle($request->validated(), $request->user());

        return (new AttendanceResource($attendance))
            ->withMessage('Employee check-in recorded')
            ->response()
            ->setStatusCode(201);
    }

    public function checkOut(ScanAttendanceRequest $request, CheckOutEmployeeAttendance $action): JsonResponse
    {
        $attendance = $action->handle($request->validated(), $request->user());

        return (new AttendanceResource($attendance))
            ->withMessage('Employee check-out recorded')
            ->response()
            ->setStatusCode(200);
    }

    public function summary(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Attendance::class);

        $validated = $request->validate([
            'month' => ['nullable', 'date_format:Y-m'],
            'employee_id' => ['nullable', 'integer', 'exists:employees,id'],
        ]);

        $month = $validated['month'] ?? now()->format('Y-m');
        $from = "{$month}-01";
        $to = Carbon::parse($from)->endOfMonth()->toDateString();

        $query = Attendance::query()
            ->join('employees', 'employees.id', '=', 'attendance.employee_id')
            ->whereBetween('attendance.date', [$from, $to])
            ->when(
                isset($validated['employee_id']),
                fn ($query) => $query->where('attendance.employee_id', $validated['employee_id'])
            )
            ->groupBy('attendance.employee_id', 'employees.name', 'employees.role', 'attendance.shift_id')
            ->select([
                'attendance.employee_id',
                'attendance.shift_id',
                'employees.name',
                'employees.role',
                DB::raw('COUNT(*) as records_count'),
                DB::raw("SUM(CASE WHEN attendance.status IN ('present', 'late') THEN 1 ELSE 0 END) as present_count"),
                DB::raw("SUM(CASE WHEN attendance.status = 'late' THEN 1 ELSE 0 END) as late_count"),
                DB::raw("SUM(CASE WHEN attendance.status = 'absent' THEN 1 ELSE 0 END) as absent_count"),
                DB::raw("SUM(CASE WHEN attendance.status = 'excused' THEN 1 ELSE 0 END) as excused_count"),
                DB::raw("SUM(CASE WHEN attendance.schedule_status = 'off_day' THEN 1 ELSE 0 END) as off_day_count"),
                DB::raw('SUM(attendance.late_minutes) as late_minutes'),
                DB::raw('SUM(attendance.early_leave_minutes) as early_leave_minutes'),
                DB::raw('SUM(attendance.off_day_bonus_amount) as off_day_bonus_amount'),
            ])
            ->orderBy('employees.name');

        return $this->success(
            data: $query->get()->map(fn ($row) => [
                'employee_id' => (int) $row->employee_id,
                'name' => $row->name,
                'role' => $row->role,
                'shift_id' => $row->shift_id ? (int) $row->shift_id : null,
                'month' => $month,
                'records_count' => (int) $row->records_count,
                'present_count' => (int) $row->present_count,
                'late_count' => (int) $row->late_count,
                'absent_count' => (int) $row->absent_count,
                'excused_count' => (int) $row->excused_count,
                'off_day_count' => (int) $row->off_day_count,
                'late_minutes' => (int) $row->late_minutes,
                'early_leave_minutes' => (int) $row->early_leave_minutes,
                'off_day_bonus_amount' => number_format((float) $row->off_day_bonus_amount, 2, '.', ''),
            ])->values(),
            message: 'Attendance monthly summary retrieved',
        );
    }

    public function store(StoreAttendanceRequest $request, StoreAttendance $action): JsonResponse
    {
        $attendance = $action->handle($request->validated());

        return (new AttendanceResource($attendance))
            ->withMessage('Attendance created')
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, Attendance $attendance): JsonResponse
    {
        $this->authorize('view', $attendance);
        $attendance->load(['employee.shift', 'shift']);

        return (new AttendanceResource($attendance))
            ->withMessage('Attendance retrieved')
            ->response()
            ->setStatusCode(200);
    }

    public function update(UpdateAttendanceRequest $request, Attendance $attendance, UpdateAttendance $action): JsonResponse
    {
        $attendance = $action->handle($attendance, $request->validated());

        return (new AttendanceResource($attendance))
            ->withMessage('Attendance updated')
            ->response()
            ->setStatusCode(200);
    }

    public function destroy(Request $request, Attendance $attendance): JsonResponse
    {
        $this->authorize('delete', $attendance);

        $attendance->delete();

        return response()->json(null, 204);
    }
}
