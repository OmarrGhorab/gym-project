<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Payroll\GeneratePayroll;
use App\Actions\Payroll\GeneratePayslip;
use App\Actions\Payroll\MarkPayrollPaid;
use App\Actions\Payroll\UpdatePayroll;
use App\Http\Requests\Payroll\GeneratePayrollRequest;
use App\Http\Requests\Payroll\IndexPayrollRequest;
use App\Http\Requests\Payroll\UpdatePayrollRequest;
use App\Http\Resources\PayrollResource;
use App\Http\Resources\PayslipResource;
use App\Models\Commission;
use App\Models\Employee;
use App\Models\Payroll;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

final class PayrollController extends ApiController
{
    public function index(IndexPayrollRequest $request): JsonResponse
    {
        $query = Payroll::query()->with('employee');

        if ($request->filled('month')) {
            $query->where('month', $request->input('month'));
        }
        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->input('employee_id'));
        }

        $payroll = $query->latest()
            ->paginate(15)
            ->withQueryString();

        return $this->success(
            data: PayrollResource::collection($payroll->getCollection())->resolve(),
            message: 'Payroll entries retrieved',
            meta: [
                'current_page' => $payroll->currentPage(),
                'per_page' => $payroll->perPage(),
                'total' => $payroll->total(),
                'last_page' => $payroll->lastPage(),
            ]
        );
    }

    public function generate(GeneratePayrollRequest $request, GeneratePayroll $action): JsonResponse
    {
        $month = $request->query('month');
        $generated = $action->execute($month);
        $activeCount = Employee::active()->count();
        $skipped = $activeCount - count($generated);

        return $this->success(
            data: PayrollResource::collection($generated)->resolve(),
            message: 'Payroll generated successfully',
            meta: [
                'month' => $month,
                'generated' => count($generated),
                'skipped_existing' => $skipped,
            ]
        );
    }

    public function update(UpdatePayrollRequest $request, $id, UpdatePayroll $action): JsonResponse
    {
        $payroll = Payroll::findOrFail($id);
        $updated = $action->execute($payroll, $request->validated());

        return (new PayrollResource($updated))
            ->withMessage('Payroll adjusted successfully')
            ->response()
            ->setStatusCode(200);
    }

    public function pay(Request $request, $id, MarkPayrollPaid $action): JsonResponse
    {
        $payroll = Payroll::findOrFail($id);
        $this->authorize('pay', $payroll);

        if ($payroll->status === 'paid') {
            return $this->error(
                code: 'already_paid',
                message: 'This payroll has already been paid.',
                details: (object) [],
                status: 409
            );
        }

        $paid = $action->execute($payroll, $request->user());

        return (new PayrollResource($paid))
            ->withMessage('Payroll paid successfully')
            ->response()
            ->setStatusCode(200);
    }

    public function payslip(Request $request, $id, GeneratePayslip $action): SymfonyResponse
    {
        $payroll = Payroll::findOrFail($id);
        $this->authorize('view', $payroll);

        $acceptHeader = $request->header('Accept', '');

        if (str_contains($acceptHeader, 'application/pdf')) {
            return $action->execute($payroll, $acceptHeader);
        }

        $payroll->load('employee');

        $monthCommissions = Commission::where('employee_id', $payroll->employee_id)
            ->where('month', $payroll->month)
            ->get();
        $payroll->setRelation('monthCommissions', $monthCommissions);

        return (new PayslipResource($payroll))
            ->withMessage('Payslip retrieved successfully')
            ->response()
            ->setStatusCode(200);
    }
}
