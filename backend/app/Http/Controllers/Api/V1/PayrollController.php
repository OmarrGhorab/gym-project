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
use App\Models\Payroll;
use App\Services\OperationalNotifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

final class PayrollController extends ApiController
{
    public function index(IndexPayrollRequest $request, GeneratePayroll $payrollGenerator): JsonResponse
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

        $perPage = min((int) $request->integer('per_page', 100), 200);
        if ($perPage < 1) {
            $perPage = 100;
        }

        $payroll = $query->latest()
            ->paginate($perPage)
            ->withQueryString();
        $payroll->getCollection()->each(function (Payroll $row) use ($payrollGenerator): void {
            if ($row->status === 'pending') {
                $payrollGenerator->refreshPendingPayroll($row);
            }
        });

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
        $result = $action->execute($month);
        $notifier = app(OperationalNotifier::class);
        collect($result['generated'])->each(fn (Payroll $payroll) => $notifier->payrollReady($payroll));

        return $this->success(
            data: PayrollResource::collection($result['generated'])->resolve(),
            message: 'Payroll generated successfully',
            meta: [
                'month' => $month,
                'generated' => $result['generated_count'],
                'refreshed' => $result['refreshed_count'],
                'skipped_existing' => $result['skipped_count'],
            ]
        )->setStatusCode(201);
    }

    public function update(UpdatePayrollRequest $request, Payroll $payroll, UpdatePayroll $action): JsonResponse
    {
        $updated = $action->execute($payroll, $request->validated());

        return (new PayrollResource($updated))
            ->withMessage('Payroll adjusted successfully')
            ->response()
            ->setStatusCode(200);
    }

    public function pay(Request $request, Payroll $payroll, MarkPayrollPaid $action): JsonResponse
    {
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

    public function payslip(Request $request, Payroll $payroll, GeneratePayslip $action): SymfonyResponse
    {
        $this->authorize('view', $payroll);

        return $action->execute($payroll, $request->header('Accept', ''));
    }
}
