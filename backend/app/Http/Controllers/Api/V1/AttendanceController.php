<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Attendance\StoreAttendance;
use App\Actions\Attendance\UpdateAttendance;
use App\Http\Requests\Attendance\StoreAttendanceRequest;
use App\Http\Requests\Attendance\UpdateAttendanceRequest;
use App\Http\Resources\AttendanceResource;
use App\Models\Attendance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

final class AttendanceController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Attendance::class);

        $attendance = QueryBuilder::for(Attendance::class)
            ->with(['employee'])
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
            ->groupBy('attendance.employee_id', 'employees.name', 'employees.role')
            ->select([
                'attendance.employee_id',
                'employees.name',
                'employees.role',
                DB::raw('COUNT(*) as records_count'),
                DB::raw("SUM(CASE WHEN attendance.status = 'present' THEN 1 ELSE 0 END) as present_count"),
                DB::raw("SUM(CASE WHEN attendance.status = 'late' THEN 1 ELSE 0 END) as late_count"),
                DB::raw("SUM(CASE WHEN attendance.status = 'absent' THEN 1 ELSE 0 END) as absent_count"),
                DB::raw("SUM(CASE WHEN attendance.status = 'excused' THEN 1 ELSE 0 END) as excused_count"),
            ])
            ->orderBy('employees.name');

        return $this->success(
            data: $query->get()->map(fn ($row) => [
                'employee_id' => (int) $row->employee_id,
                'name' => $row->name,
                'role' => $row->role,
                'month' => $month,
                'records_count' => (int) $row->records_count,
                'present_count' => (int) $row->present_count,
                'late_count' => (int) $row->late_count,
                'absent_count' => (int) $row->absent_count,
                'excused_count' => (int) $row->excused_count,
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
        $attendance->load('employee');

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
