<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Attendance\BuildDailyAttendanceReport;
use App\Actions\Attendance\CheckInEmployeeAttendance;
use App\Actions\Attendance\CheckOutEmployeeAttendance;
use App\Actions\Attendance\StoreAttendance;
use App\Actions\Attendance\UpdateAttendance;
use App\Http\Requests\Attendance\ScanAttendanceRequest;
use App\Http\Requests\Attendance\StoreAttendanceRequest;
use App\Http\Requests\Attendance\StoreEmployeeShiftRequest;
use App\Http\Requests\Attendance\UpdateAttendanceRequest;
use App\Http\Requests\Attendance\UpdateEmployeeShiftRequest;
use App\Http\Resources\AttendanceResource;
use App\Http\Resources\EmployeeResource;
use App\Http\Resources\EmployeeShiftResource;
use App\Models\Attendance;
use App\Models\DailyAttendanceReport;
use App\Models\Employee;
use App\Models\EmployeeShift;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
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
                // Checked in with no check-out — the only attendance row that still
                // needs somebody to act on it.
                AllowedFilter::callback('open', function ($query, $value): void {
                    if (! filter_var($value, FILTER_VALIDATE_BOOL)) {
                        return;
                    }

                    $query->whereNotNull('check_in')->whereNull('check_out');
                }),
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
            data: EmployeeShiftResource::collection(EmployeeShift::query()->where('is_active', true)->orderBy('name')->get())->resolve(),
            message: 'Employee shifts retrieved',
        );
    }

    public function employeeOptions(Request $request): JsonResponse
    {
        ($request->user()->can('attendance.view') || $request->user()->can('attendance.create')) || abort(403);

        $perPage = min(max((int) $request->integer('per_page', 100), 1), 100);

        $query = Employee::query()
            ->where('status', 'active')
            ->with(['user.roles', 'shift']);

        $search = trim((string) ($request->input('filter.q') ?? $request->input('q') ?? ''));

        if ($search !== '') {
            $attendanceCode = str_starts_with($search, 'employee:') ? substr($search, 9) : $search;

            $query->where(function ($builder) use ($attendanceCode, $search): void {
                $builder->where('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");

                if (ctype_digit($search)) {
                    $builder->orWhere('id', (int) $search);
                }

                if ($attendanceCode !== '') {
                    $builder->orWhere('attendance_code', $attendanceCode);
                }
            });
        }

        $employees = $query->orderBy('name')->paginate($perPage);

        return $this->success(
            data: EmployeeResource::collection($employees->getCollection())->resolve(),
            message: 'Employee options retrieved',
        );
    }

    public function manageShifts(Request $request): JsonResponse
    {
        $request->user()->can('settings.manage') || abort(403);

        return $this->success(
            data: EmployeeShiftResource::collection(
                EmployeeShift::query()->orderBy('name')->get()
            )->resolve(),
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

    /**
     * Serve the day's attendance PDF — the same sheet the nightly job mails out.
     *
     * A stored copy is served when the scheduler already built one, otherwise it
     * is rendered on demand so an admin can pull any day, not just last night.
     */
    public function dailyReport(Request $request, BuildDailyAttendanceReport $builder)
    {
        $this->authorize('viewAny', Attendance::class);

        $validated = $request->validate([
            'date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $businessDate = Carbon::parse($validated['date'] ?? now()->toDateString())->startOfDay();
        $filename = $builder->filename($businessDate);
        $stored = DailyAttendanceReport::query()
            ->whereDate('business_date', $businessDate->toDateString())
            ->value('file_path');
        $disk = (string) config('export.disk', 'local');

        $pdf = $stored !== null && Storage::disk($disk)->exists($stored)
            ? Storage::disk($disk)->get($stored)
            : $builder->pdf($businessDate);

        return response($pdf, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "inline; filename=\"{$filename}\"",
        ]);
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
                DB::raw("SUM(CASE WHEN attendance.status = 'present' THEN 1 ELSE 0 END) as present_count"),
                DB::raw("SUM(CASE WHEN attendance.status = 'absent' THEN 1 ELSE 0 END) as absent_count"),
                DB::raw("SUM(CASE WHEN attendance.status = 'excused' THEN 1 ELSE 0 END) as excused_count"),
                DB::raw('SUM(CASE WHEN attendance.check_in IS NOT NULL AND attendance.check_out IS NULL THEN 1 ELSE 0 END) as open_count'),
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
                'absent_count' => (int) $row->absent_count,
                'excused_count' => (int) $row->excused_count,
                'open_count' => (int) $row->open_count,
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
