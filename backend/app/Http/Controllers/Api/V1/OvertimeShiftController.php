<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Overtime\ResolveUncoveredShifts;
use App\Actions\Overtime\ReviewOvertimeShift;
use App\Actions\Overtime\StoreOvertimeShift;
use App\Actions\Overtime\SummarizeOvertimeShifts;
use App\Http\Requests\Overtime\IndexOvertimeShiftRequest;
use App\Http\Requests\Overtime\ReviewOvertimeShiftRequest;
use App\Http\Requests\Overtime\StoreOvertimeShiftRequest;
use App\Http\Requests\Overtime\SummarizeOvertimeShiftRequest;
use App\Http\Resources\OvertimeShiftResource;
use App\Models\OvertimeShift;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

class OvertimeShiftController extends ApiController
{
    public function index(IndexOvertimeShiftRequest $request): JsonResponse
    {
        $filters = $request->validated();

        $query = OvertimeShift::query()
            ->with(['employee', 'coveringFor', 'shift', 'reviewedBy'])
            ->when($filters['date'] ?? null, fn ($q, $date) => $q->whereDate('date', Carbon::parse($date)->toDateString()))
            ->when($filters['month'] ?? null, function ($q, $month) {
                $from = Carbon::parse($month.'-01')->startOfMonth()->toDateString();

                return $q->whereBetween('date', [$from, Carbon::parse($from)->endOfMonth()->toDateString()]);
            })
            ->when($filters['from'] ?? null, fn ($q, $from) => $q->whereDate('date', '>=', Carbon::parse($from)->toDateString()))
            ->when($filters['to'] ?? null, fn ($q, $to) => $q->whereDate('date', '<=', Carbon::parse($to)->toDateString()))
            ->when($filters['employee_id'] ?? null, fn ($q, $employeeId) => $q->where('employee_id', $employeeId))
            ->when($filters['status'] ?? null, fn ($q, $status) => $q->where('status', $status))
            ->orderByDesc('date')
            ->orderByDesc('id');

        $shifts = $query->paginate((int) ($filters['per_page'] ?? 25));

        return $this->success(
            data: OvertimeShiftResource::collection($shifts->getCollection())->resolve(),
            message: 'Overtime shifts retrieved',
            meta: [
                'current_page' => $shifts->currentPage(),
                'per_page' => $shifts->perPage(),
                'total' => $shifts->total(),
                'last_page' => $shifts->lastPage(),
            ],
        );
    }

    /**
     * Shifts left uncovered today because the assigned employee never checked in.
     */
    public function candidates(IndexOvertimeShiftRequest $request, ResolveUncoveredShifts $action): JsonResponse
    {
        $date = $request->filled('date')
            ? Carbon::parse($request->input('date'))
            : Carbon::today();

        return $this->success(
            data: $action->handle($date),
            message: 'Uncovered shifts retrieved',
            meta: ['date' => $date->toDateString()],
        );
    }

    public function summary(SummarizeOvertimeShiftRequest $request, SummarizeOvertimeShifts $action): JsonResponse
    {
        $month = $request->input('month') ?: Carbon::today()->format('Y-m');

        return $this->success(
            data: $action->handle($month),
            message: 'Overtime summary retrieved',
            meta: ['month' => $month],
        );
    }

    public function store(StoreOvertimeShiftRequest $request, StoreOvertimeShift $action): JsonResponse
    {
        $overtimeShift = $action->handle($request->validated(), $request->user());

        return (new OvertimeShiftResource($overtimeShift))
            ->withMessage('Overtime shift recorded')
            ->response()
            ->setStatusCode(201);
    }

    public function review(
        ReviewOvertimeShiftRequest $request,
        OvertimeShift $overtimeShift,
        ReviewOvertimeShift $action,
    ): JsonResponse {
        $reviewed = $action->handle($overtimeShift, $request->validated(), $request->user());

        return (new OvertimeShiftResource($reviewed))
            ->withMessage('Overtime shift reviewed')
            ->response()
            ->setStatusCode(200);
    }

    public function destroy(OvertimeShift $overtimeShift): JsonResponse
    {
        if ($overtimeShift->status === OvertimeShift::STATUS_SETTLED) {
            return $this->error(
                code: 'overtime_settled',
                message: 'A settled overtime shift cannot be deleted.',
                details: (object) [],
                status: 409,
            );
        }

        $overtimeShift->delete();

        return $this->success(data: null, message: 'Overtime shift removed');
    }
}
