<?php

namespace App\Actions\Payroll;

use App\Http\Resources\PayslipResource;
use App\Models\Commission;
use App\Models\Payroll;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class GeneratePayslip
{
    /**
     * Generate HTML, PDF, or JSON payslip for a payroll record.
     */
    public function execute(Payroll $payroll, string $acceptHeader): Response
    {
        try {
            $payroll->load(['employee']);

            $monthCommissions = Commission::where('employee_id', $payroll->employee_id)
                ->where('month', $payroll->month)
                ->get();
            $payroll->setRelation('monthCommissions', $monthCommissions);

            if (str_contains($acceptHeader, 'application/pdf')) {
                $pdf = Pdf::loadView('payroll.payslip', [
                    'payroll' => $payroll,
                ]);

                return response($pdf->output(), 200, [
                    'Content-Type' => 'application/pdf',
                    'Content-Disposition' => "inline; filename=\"payslip-{$payroll->id}.pdf\"",
                ]);
            }

            if (str_contains($acceptHeader, 'application/json')) {
                return (new PayslipResource($payroll))
                    ->withMessage('Payslip retrieved successfully')
                    ->response()
                    ->setStatusCode(200);
            }

            return response()->view('payroll.payslip', [
                'payroll' => $payroll,
            ]);
        } catch (\Throwable $e) {
            Log::error('Payslip generation failed: '.$e->getMessage(), [
                'exception' => $e,
                'payroll_id' => $payroll->id,
            ]);

            abort(500, 'Payslip generation failed.');
        }
    }
}
