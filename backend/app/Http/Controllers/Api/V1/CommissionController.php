<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Commissions\CalculateCommission;
use App\Console\Commands\BackfillCommissionsCommand;
use App\Http\Resources\CommissionResource;
use App\Models\Commission;
use App\Models\Employee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class CommissionController extends ApiController
{
    public function index(Request $request, $employeeId): JsonResponse
    {
        $employee = Employee::findOrFail($employeeId);
        $this->authorize('viewAny', Commission::class);

        $query = Commission::where('employee_id', $employee->id);

        if ($request->filled('month')) {
            $query->where('month', $request->input('month'));
        }

        $totalAmount = (string) $query->sum('amount');

        $commissions = $query->latest()
            ->paginate(15)
            ->withQueryString();

        return $this->success(
            data: CommissionResource::collection($commissions->getCollection())->resolve(),
            message: 'Commissions retrieved',
            meta: [
                'current_page' => $commissions->currentPage(),
                'per_page' => $commissions->perPage(),
                'total' => $commissions->total(),
                'last_page' => $commissions->lastPage(),
                'total_amount' => number_format((float) $totalAmount, 2, '.', ''),
            ],
        );
    }

    public function backfill(Request $request, CalculateCommission $action): JsonResponse
    {
        $this->authorize('backfill', Commission::class);

        $command = new BackfillCommissionsCommand;
        $results = $command->executeBackfill(
            $action,
            $request->input('from'),
            $request->input('to'),
            $request->input('dry_run', false) ? true : false
        );

        return $this->success(
            data: $results,
            message: 'Commissions backfill completed',
        );
    }
}
