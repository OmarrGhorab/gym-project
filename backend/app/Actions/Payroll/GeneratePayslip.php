<?php

namespace App\Actions\Payroll;

use App\Http\Resources\PayslipResource;
use App\Models\Attendance;
use App\Models\AttendanceViolation;
use App\Models\Commission;
use App\Models\Payroll;
use ArPHP\I18N\Arabic;
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
            $payroll->load(['employee.shift']);

            $monthCommissions = Commission::where('employee_id', $payroll->employee_id)
                ->where('month', $payroll->month)
                ->get();
            $payroll->setRelation('monthCommissions', $monthCommissions);
            $attendanceRows = Attendance::query()
                ->where('employee_id', $payroll->employee_id)
                ->whereBetween('date', [
                    "{$payroll->month}-01",
                    now()->parse("{$payroll->month}-01")->endOfMonth()->toDateString(),
                ])
                ->get();
            $payroll->setRelation('monthAttendance', $attendanceRows);

            $violations = AttendanceViolation::query()
                ->with('rule')
                ->where('employee_id', $payroll->employee_id)
                ->whereBetween('violation_date', [
                    "{$payroll->month}-01",
                    now()->parse("{$payroll->month}-01")->endOfMonth()->toDateString(),
                ])
                ->orderBy('violation_date')
                ->orderBy('id')
                ->get();
            $payroll->setRelation('attendanceViolations', $violations);

            if (str_contains($acceptHeader, 'application/pdf')) {
                $arabic = new Arabic;
                $pdf = Pdf::loadView('payroll.payslip', [
                    'pdfArabic' => static fn (?string $text): string => $text
                        ? $arabic->utf8Glyphs($text, 120, false, true)
                        : '',
                    'payroll' => $payroll,
                ])->setPaper('a4', 'landscape')
                    ->setOption('defaultFont', 'DejaVu Sans')
                    ->setOption('isHtml5ParserEnabled', true);

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
                'pdfArabic' => static fn (?string $text): string => $text ?? '',
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
