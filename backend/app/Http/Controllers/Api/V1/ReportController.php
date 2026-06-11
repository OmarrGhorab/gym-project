<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Reports\EmployeePerformanceReport;
use App\Actions\Reports\FinancialReport;
use App\Http\Requests\Reports\EmployeePerformanceRequest;
use App\Http\Requests\Reports\FinancialReportRequest;
use Illuminate\Http\JsonResponse;

final class ReportController extends ApiController
{
    public function financial(FinancialReportRequest $request, FinancialReport $action): JsonResponse
    {
        $report = $action->execute($request->validated());

        return $this->success(
            data: $report['data'],
            message: 'Financial report generated',
            meta: $report['meta']
        );
    }

    public function employees(EmployeePerformanceRequest $request, EmployeePerformanceReport $action): JsonResponse
    {
        $report = $action->execute($request->validated());

        return $this->success(
            data: $report->items(),
            message: 'Employee performance report retrieved',
            meta: [
                'next_cursor' => $report->nextCursor()?->encode(),
                'prev_cursor' => $report->previousCursor()?->encode(),
                'per_page' => $report->perPage(),
            ]
        );
    }
}
