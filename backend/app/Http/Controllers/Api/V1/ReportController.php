<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Reports\EmployeePerformanceReport;
use App\Actions\Reports\FinanceDashboardSummary;
use App\Actions\Reports\FinancialReport;
use App\Actions\Reports\LiveAttendanceSummary;
use App\Actions\Reports\OperationsSummary;
use App\Http\Requests\Reports\EmployeePerformanceRequest;
use App\Http\Requests\Reports\FinancialReportRequest;
use App\Http\Requests\Reports\StoreOperationsCalendarEventRequest;
use App\Models\OperationsCalendarEvent;
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

    public function financeSummary(FinanceDashboardSummary $action): JsonResponse
    {
        return $this->success(
            data: $action->execute(),
            message: 'Finance dashboard summary retrieved',
        );
    }

    public function liveAttendance(LiveAttendanceSummary $action): JsonResponse
    {
        return $this->success(
            data: $action->execute(),
            message: 'Live attendance summary retrieved',
        );
    }

    public function operationsSummary(OperationsSummary $action): JsonResponse
    {
        return $this->success(
            data: $action->execute(),
            message: 'Operations summary retrieved',
        );
    }

    public function storeOperationsCalendarEvent(StoreOperationsCalendarEventRequest $request): JsonResponse
    {
        $event = OperationsCalendarEvent::query()->create([
            ...$request->validated(),
            'type' => $request->validated('type', 'manual'),
            'created_by' => $request->user()->id,
        ]);

        return $this->success(
            data: [
                'id' => $event->id,
                'date' => $event->date?->toDateString(),
                'title' => $event->title,
                'type' => $event->type,
                'notes' => $event->notes,
            ],
            message: 'Operations calendar event created',
            status: 201,
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
