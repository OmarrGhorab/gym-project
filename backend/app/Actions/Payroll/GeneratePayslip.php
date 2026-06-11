<?php

namespace App\Actions\Payroll;

use App\Models\Payroll;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class GeneratePayslip
{
    /**
     * Generate HTML or PDF payslip for a payroll record.
     */
    public function execute(Payroll $payroll, string $acceptHeader): Response
    {
        try {
            $payroll->load(['employee']);

            if (str_contains($acceptHeader, 'application/pdf')) {
                $pdf = Pdf::loadView('payroll.payslip', [
                    'payroll' => $payroll,
                ]);

                return response($pdf->output(), 200, [
                    'Content-Type' => 'application/pdf',
                    'Content-Disposition' => "inline; filename=\"payslip-{$payroll->id}.pdf\"",
                ]);
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
