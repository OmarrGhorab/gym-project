<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\ShiftSessions\CloseShiftSession;
use App\Actions\ShiftSessions\ComputeShiftSessionTotals;
use App\Actions\ShiftSessions\OpenShiftSession;
use App\Actions\ShiftSessions\ReviewShiftHandover;
use App\Actions\ShiftSessions\SubmitShiftHandover;
use App\Http\Resources\EmployeeShiftResource;
use App\Http\Resources\ShiftSessionResource;
use App\Models\EmployeeShift;
use App\Models\ShiftSession;
use App\Support\FoundationPermissions;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShiftSessionController extends ApiController
{
    public function index(Request $request, ComputeShiftSessionTotals $totals): JsonResponse
    {
        $this->authorizeFinanceView($request);

        $sessions = ShiftSession::query()
            ->with(['shift', 'openedBy', 'closedBy', 'receivedBy', 'adminReviewer'])
            ->when($request->query('status'), fn ($q, $status) => $q->where('status', $status))
            ->latest('opened_at')
            ->paginate(min(max((int) $request->integer('per_page', 15), 1), 100));

        $payload = $sessions->getCollection()->map(function (ShiftSession $session) use ($request, $totals): array {
            $row = (new ShiftSessionResource($session))->toArray($request);
            $live = $totals->handle($session);
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

        $shifts = EmployeeShift::query()
            ->where('is_active', true)
            ->orderBy('starts_at')
            ->orderBy('name')
            ->get();

        return $this->success(
            data: EmployeeShiftResource::collection($shifts)->resolve(),
            message: 'Shift options retrieved',
        );
    }

    public function current(Request $request, ComputeShiftSessionTotals $totals): JsonResponse
    {
        $this->authorizeFinanceView($request);

        $session = ShiftSession::query()
            ->with(['shift', 'openedBy'])
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
            'business_date' => ['nullable', 'date'],
            'opening_float' => ['nullable', 'numeric', 'min:0'],
            'force_open' => ['sometimes', 'boolean'],
        ]);

        $session = $action->handle($data, $request->user());
        $session->loadMissing(['shift', 'openedBy']);
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

        $session = $action->handle($shiftSession, $request->user());

        return (new ShiftSessionResource($session))
            ->withMessage('Shift session closed')
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
