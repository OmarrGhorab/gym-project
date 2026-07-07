<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\EmployeePlanCommissionRules\StoreEmployeePlanCommissionRule;
use App\Actions\EmployeePlanCommissionRules\UpdateEmployeePlanCommissionRule;
use App\Http\Requests\EmployeePlanCommissionRules\StoreEmployeePlanCommissionRuleRequest;
use App\Http\Requests\EmployeePlanCommissionRules\UpdateEmployeePlanCommissionRuleRequest;
use App\Http\Resources\EmployeePlanCommissionRuleResource;
use App\Models\Employee;
use App\Models\EmployeePlanCommissionRule;
use Illuminate\Http\JsonResponse;

class EmployeePlanCommissionRuleController extends ApiController
{
    public function store(
        StoreEmployeePlanCommissionRuleRequest $request,
        Employee $employee,
        StoreEmployeePlanCommissionRule $action,
    ): JsonResponse {
        $rule = $action->handle($employee, $request->validated());

        return (new EmployeePlanCommissionRuleResource($rule))
            ->withMessage('Employee plan commission rule created')
            ->response()
            ->setStatusCode(201);
    }

    public function update(
        UpdateEmployeePlanCommissionRuleRequest $request,
        Employee $employee,
        EmployeePlanCommissionRule $employeePlanCommissionRule,
        UpdateEmployeePlanCommissionRule $action,
    ): JsonResponse {
        abort_unless($employeePlanCommissionRule->employee_id === $employee->id, 404);

        $rule = $action->handle($employeePlanCommissionRule, $request->validated());

        return (new EmployeePlanCommissionRuleResource($rule))
            ->withMessage('Employee plan commission rule updated')
            ->response()
            ->setStatusCode(200);
    }

    public function destroy(Employee $employee, EmployeePlanCommissionRule $employeePlanCommissionRule): JsonResponse
    {
        $this->authorize('update', $employee);
        abort_unless($employeePlanCommissionRule->employee_id === $employee->id, 404);

        $employeePlanCommissionRule->delete();

        return response()->json(null, 204);
    }
}
