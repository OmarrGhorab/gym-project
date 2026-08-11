<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\ShiftSessions\AssignShiftStaff;
use App\Actions\ShiftSessions\CloseShiftSession;
use App\Actions\ShiftSessions\ComputeShiftSessionTotals;
use App\Actions\ShiftSessions\OpenShiftSession;
use App\Actions\ShiftSessions\ReviewShiftHandover;
use App\Actions\ShiftSessions\SubmitShiftHandover;
use App\Http\Resources\EmployeeShiftResource;
use App\Http\Resources\ShiftSessionResource;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Expense;
use App\Models\Payment;
use App\Models\ShiftSession;
use App\Support\FoundationPermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class ShiftSessionController extends ApiController
{
    public function index(Request $request, ComputeShiftSessionTotals $totals): JsonResponse
    {
        $this->authorizeFinanceView($request);

        $sessions = ShiftSession::query()
            ->with(['shift', 'openedBy', 'closedBy', 'receivedBy', 'adminReviewer', 'openedByEmployee', 'closedByEmployee'])
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->when($request->query('business_date'), fn ($q, $date) => $q->whereDate('business_date', $date))
            ->when($request->query('from'), fn ($q, $from) => $q->whereDate('business_date', '>=', $from))
            ->when($request->query('to'), fn ($q, $to) => $q->whereDate('business_date', '<=', $to))
            ->latest('opened_at')
            ->paginate(min(max((int) $request->integer('per_page', 15), 1), 100));

        $rows = $sessions->getCollection();

        // Claim untagged money for every listed session first, then read the tagged
        // rows in two batched queries instead of five statements per session.
        foreach ($rows as $session) {
            $totals->claimOrphanMoney($session);
        }

        $ids = $rows->pluck('id');

        $paymentsBySession = Payment::query()
            ->revenue()
            ->whereIn('shift_session_id', $ids)
            ->get(['id', 'amount', 'method', 'status', 'payable_type', 'payable_id', 'paid_at', 'shift_session_id'])
            ->groupBy('shift_session_id');

        $expenseAgg = Expense::query()
            ->whereIn('shift_session_id', $ids)
            ->selectRaw('shift_session_id, COUNT(*) as rows_count, COALESCE(SUM(amount), 0) as amount_sum')
            ->groupBy('shift_session_id')
            ->get()
            ->keyBy('shift_session_id');

        $payload = $rows->map(function (ShiftSession $session) use ($request, $totals, $paymentsBySession, $expenseAgg): array {
            $row = (new ShiftSessionResource($session))->toArray($request);
            $agg = $expenseAgg->get($session->id);
            $live = $totals->computeFrom(
                $session,
                $paymentsBySession->get($session->id, collect()),
                (int) ($agg->rows_count ?? 0),
                bcadd((string) ($agg->amount_sum ?? 0), '0.00', 2),
            );
            $row['live_totals'] = $live;
            $row['variance'] = $this->varianceSnapshot($session);

            return $row;
        })->values()->all();

        return $this->success(
            data: $payload,
            message: 'Shift sessions retrieved',
            meta: [
                'current_page' => $sessions->currentPage(),
                'per_page' => $sessions->perPage(),
                'total' => $sessions->total(),
                'last_page' => $sessions->lastPage(),
            ],
        );
    }

    /**
     * Active employee shifts for the finance shift desk (no attendance.view required).
     */
    public function shiftOptions(Request $request): JsonResponse
    {
        $this->authorizeFinanceView($request);
        $data = $request->validate(['date' => ['nullable', 'date']]);
        $date = isset($data['date']) ? Carbon::parse($data['date'])->toDateString() : Carbon::today()->toDateString();

        $allEmployees = Employee::query()
            ->active()
            ->select('id', 'name', 'role', 'shift_id')
            ->orderBy('name')
            ->get();

        $shifts = EmployeeShift::query()
            ->where('is_active', true)
            // The picker includes every active employee. Those whose home shift
            // this is sort first, but any of them can be put on the desk.
            ->orderBy('name')
            ->get();

        $payload = $shifts->map(function (EmployeeShift $shift) use ($allEmployees, $request): array {
            $row = (new EmployeeShiftResource($shift))->toArray($request);
            $row['employees'] = $allEmployees
                ->sortBy(fn ($employee): string => sprintf(
                    '%d:%s',
                    (int) $employee->shift_id === (int) $shift->id ? 0 : 1,
                    mb_strtolower((string) $employee->name),
                ))
                ->unique('id')
                // Everyone is listed by name, the signed-in employee included.
                ->map(fn ($employee): array => [
                    'id' => $employee->id,
                    'name' => $employee->name,
                    'role' => $employee->role,
                ])
                ->values()
                ->all();

            return $row;
        })->all();

        return $this->success(
            data: $payload,
            message: 'Shift options retrieved',
        );
    }

    public function current(Request $request, ComputeShiftSessionTotals $totals): JsonResponse
    {
        $this->authorizeFinanceView($request);

        // Desks are opened and closed by hand, so the live one is simply the most
        // recently opened session that nobody has closed yet.
        $session = ShiftSession::query()
            ->with(['shift', 'openedBy', 'closedBy', 'openedByEmployee', 'closedByEmployee'])
            ->where('status', ShiftSession::STATUS_OPEN)
            ->orderByDesc('opened_at')
            ->first();

        if (! $session) {
            return $this->success(data: null, message: 'No open shift session');
        }

        $live = $totals->handle($session);

        return $this->success(
            data: array_merge(
                (new ShiftSessionResource($session))->toArray($request),
                [
                    'live_totals' => $live,
                    'variance' => $this->varianceSnapshot($session),
                ],
            ),
            message: 'Current shift session retrieved',
        );
    }

    public function store(Request $request, OpenShiftSession $action, ComputeShiftSessionTotals $totals): JsonResponse
    {
        $this->authorizeFinanceCreate($request);

        $data = $request->validate([
            'employee_shift_id' => ['required', 'integer', 'exists:employee_shifts,id'],
            'employee_id' => ['nullable', 'integer', 'exists:employees,id'],
            'business_date' => ['nullable', 'date'],
            'opening_float' => ['nullable', 'numeric', 'min:0'],
        ]);

        $session = $action->handle($data, $request->user());
        $session->loadMissing(['shift', 'openedBy', 'openedByEmployee']);
        $live = $totals->handle($session);

        return $this->success(
            data: array_merge(
                (new ShiftSessionResource($session))->toArray($request),
                ['live_totals' => $live],
            ),
            message: 'Shift session opened',
            status: 201,
        );
    }

    public function close(Request $request, ShiftSession $shiftSession, CloseShiftSession $action): JsonResponse
    {
        $this->authorizeFinanceCreate($request);

        $data = $request->validate([
            'employee_id' => ['nullable', 'integer', 'exists:employees,id'],
        ]);

        $session = $action->handle($shiftSession, $request->user(), $data);

        return (new ShiftSessionResource($session))
            ->withMessage('Shift session closed')
            ->response()
            ->setStatusCode(200);
    }

    public function assignStaff(Request $request, ShiftSession $shiftSession, AssignShiftStaff $action): JsonResponse
    {
        $this->authorizeFinanceCreate($request);

        $data = $request->validate([
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
        ]);

        $session = $action->handle($shiftSession, $data, $request->user());

        return (new ShiftSessionResource($session))
            ->withMessage('Staff on duty updated')
            ->response()
            ->setStatusCode(200);
    }

    public function handover(Request $request, ShiftSession $shiftSession, SubmitShiftHandover $action): JsonResponse
    {
        $this->authorizeFinanceCreate($request);

        $data = $request->validate([
            'counted_cash' => ['required', 'numeric', 'min:0'],
            'counted_card' => ['required', 'numeric', 'min:0'],
            'counted_bank' => ['required', 'numeric', 'min:0'],
            'counted_expenses' => ['required', 'numeric', 'min:0'],
            'variance_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $session = $action->handle($shiftSession, $data, $request->user());

        return (new ShiftSessionResource($session))
            ->withMessage('Shift handover submitted')
            ->response()
            ->setStatusCode(200);
    }

    public function review(Request $request, ShiftSession $shiftSession, ReviewShiftHandover $action): JsonResponse
    {
        $user = $request->user();
        // Prefer settings/expenses review rights; Admin role always allowed (tests seed Admin without full matrix).
        if (
            ! $user
            || (
                ! $user->can('settings.manage')
                && ! $user->can('expenses.update')
                && ! $user->can('expenses.create')
                && ! $user->hasRole(FoundationPermissions::ROLE_ADMIN)
            )
        ) {
            abort(403);
        }

        $data = $request->validate([
            'decision' => ['required', 'string', 'in:accepted,rejected'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $session = $action->handle($shiftSession, $data, $user);

        return $this->success(
            data: (new ShiftSessionResource($session))->toArray($request),
            message: 'Shift handover reviewed',
        );
    }

    private function authorizeFinanceView(Request $request): void
    {
        $user = $request->user();
        if (! $user?->can('expenses.view') && ! $user?->can('attendance.view') && ! $user?->can('payments.view')) {
            abort(403);
        }
    }

    private function authorizeFinanceCreate(Request $request): void
    {
        $user = $request->user();
        if (! $user?->can('expenses.create') && ! $user?->can('attendance.create') && ! $user?->can('payments.create')) {
            abort(403);
        }
    }

    /**
     * Expected (system) vs counted (physical) with per-line variance for handover review.
     *
     * @return array<string, array{expected: string|null, counted: string|null, variance: string|null}>
     */
    private function varianceSnapshot(ShiftSession $session): array
    {
        $lines = [
            'cash' => [(string) ($session->expected_cash ?? ''), (string) ($session->counted_cash ?? '')],
            'card' => [(string) ($session->expected_card ?? ''), (string) ($session->counted_card ?? '')],
            'bank' => [(string) ($session->expected_bank ?? ''), (string) ($session->counted_bank ?? '')],
            'expenses' => [(string) ($session->expected_expenses ?? ''), (string) ($session->counted_expenses ?? '')],
        ];

        $out = [];
        foreach ($lines as $key => [$expected, $counted]) {
            $expectedFmt = $expected === '' ? null : bcadd($expected, '0.00', 2);
            $countedFmt = $counted === '' ? null : bcadd($counted, '0.00', 2);
            $variance = null;
            if ($expectedFmt !== null && $countedFmt !== null) {
                $variance = bcsub($countedFmt, $expectedFmt, 2);
            }

            $out[$key] = [
                'expected' => $expectedFmt,
                'counted' => $countedFmt,
                'variance' => $variance,
            ];
        }

        return $out;
    }
}
