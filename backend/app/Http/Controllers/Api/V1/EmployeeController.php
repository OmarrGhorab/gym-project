<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Employees\StoreEmployee;
use App\Actions\Employees\UpdateEmployee;
use App\Actions\Reports\EmployeePerformanceReport;
use App\Http\Requests\Employees\StoreEmployeeRequest;
use App\Http\Requests\Employees\UpdateEmployeeRequest;
use App\Http\Requests\Reports\EmployeePerformanceRequest;
use App\Http\Resources\EmployeeResource;
use App\Models\Employee;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

final class EmployeeController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Employee::class);

        $employees = QueryBuilder::for(Employee::class)
            ->with(['user.roles', 'shift'])
            ->allowedFilters(
                AllowedFilter::exact('role'),
                AllowedFilter::exact('status'),
                AllowedFilter::callback('q', function ($query, string $value): void {
                    $value = trim($value);
                    $query->where(function ($q) use ($value): void {
                        $q->where('name', 'like', "%{$value}%")
                            ->orWhere('phone', 'like', "%{$value}%");
                    });
                })
            )
            ->allowedSorts('name', 'role', 'status', 'created_at')
            ->defaultSort('-created_at')
            ->paginate(15)
            ->withQueryString();

        return $this->success(
            data: EmployeeResource::collection($employees->getCollection())->resolve(),
            message: 'Employees retrieved',
            meta: [
                'current_page' => $employees->currentPage(),
                'per_page' => $employees->perPage(),
                'total' => $employees->total(),
                'last_page' => $employees->lastPage(),
            ],
        );
    }

    public function store(StoreEmployeeRequest $request, StoreEmployee $action): JsonResponse
    {
        $employee = $action->handle($request->validated());
        $employee->load(['user.roles', 'shift']);

        return (new EmployeeResource($employee))
            ->withMessage('Employee created')
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, Employee $employee): JsonResponse
    {
        $this->authorize('view', $employee);
        $employee->load(['user.roles', 'shift']);

        return (new EmployeeResource($employee))
            ->withMessage('Employee retrieved')
            ->response()
            ->setStatusCode(200);
    }

    public function update(UpdateEmployeeRequest $request, Employee $employee, UpdateEmployee $action): JsonResponse
    {
        $employee = $action->handle($employee, $request->validated());
        $employee->load(['user.roles', 'shift']);

        return (new EmployeeResource($employee))
            ->withMessage('Employee updated')
            ->response()
            ->setStatusCode(200);
    }

    public function destroy(Request $request, Employee $employee): JsonResponse
    {
        $this->authorize('delete', $employee);

        if ($employee->commissions()->exists() || $employee->payrolls()->exists()) {
            return $this->error(
                code: 'delete_failed',
                message: 'Cannot delete employee with financial history.',
                details: (object) [],
                status: 409
            );
        }

        $employee->delete();

        return response()->json(null, 204);
    }

    public function performance(EmployeePerformanceRequest $request, Employee $employee, EmployeePerformanceReport $action): JsonResponse
    {
        $params = $request->validated();
        $params['employee_id'] = $employee->id;

        $report = $action->execute($params);

        if (! $report) {
            return $this->error('employee_not_found', 'Employee performance not found', [], 404);
        }

        return $this->success(
            data: $report,
            message: 'Employee performance report retrieved'
        );
    }
}
