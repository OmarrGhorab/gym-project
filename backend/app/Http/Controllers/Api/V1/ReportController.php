<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Reports\EmployeePerformanceReport;
use App\Actions\Reports\FinanceDashboardSummary;
use App\Actions\Reports\FinancialReport;
use App\Actions\Reports\InventoryLogisticsSummary;
use App\Actions\Reports\LiveAttendanceSummary;
use App\Actions\Reports\OperationsSummary;
use App\Actions\Reports\PosDashboardSummary;
use App\Actions\Reports\StaffAcademySummary;
use App\Actions\Reports\SystemHealthSummary;
use App\Http\Requests\Reports\EmployeePerformanceRequest;
use App\Http\Requests\Reports\FinancialReportRequest;
use App\Http\Requests\Reports\StoreOperationsCalendarEventRequest;
use App\Http\Requests\Reports\UpdateOperationsCalendarEventRequest;
use App\Models\AttendanceViolation;
use App\Models\OperationsCalendarEvent;
use App\Models\Payroll;
use App\Models\Product;
use App\Models\Subscription;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

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

    public function posSummary(Request $request, PosDashboardSummary $action): JsonResponse
    {
        return $this->success(
            data: $action->execute($request->validate([
                'period' => ['nullable', 'string', Rule::in(['this-month', 'last-month', 'last-30-days', 'year-to-date'])],
                'payment_method' => ['nullable', 'string', Rule::in(['pos', 'cash', 'card', 'bank_transfer'])],
            ])),
            message: 'POS dashboard summary retrieved',
        );
    }

    public function staffAcademy(StaffAcademySummary $action): JsonResponse
    {
        return $this->success(
            data: $action->execute(),
            message: 'Staff academy summary retrieved',
        );
    }

    public function inventoryLogistics(InventoryLogisticsSummary $action): JsonResponse
    {
        return $this->success(
            data: $action->execute(),
            message: 'Inventory logistics summary retrieved',
        );
    }

    public function systemHealth(SystemHealthSummary $action): JsonResponse
    {
        return $this->success(
            data: $action->execute(),
            message: 'System health summary retrieved',
        );
    }

    public function operationsCalendarEvents(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'type' => ['nullable', 'string', Rule::in(['manual', 'shift', 'class', 'pt_session', 'maintenance', 'renewal', 'payroll', 'attendance', 'inventory', 'finance'])],
        ]);

        $from = CarbonImmutable::parse($validated['from'] ?? now()->startOfMonth())->startOfDay();
        $to = CarbonImmutable::parse($validated['to'] ?? now()->addMonthsNoOverflow(2)->endOfMonth())->endOfDay();
        $type = $validated['type'] ?? null;

        $events = collect()
            ->merge($this->customCalendarEvents($from, $to))
            ->merge($this->generatedCalendarEvents($from, $to))
            ->when($type, fn ($items) => $items->where('type', $type))
            ->sortBy(['start', 'title'])
            ->values()
            ->all();

        return $this->success(
            data: $events,
            message: 'Operations calendar events retrieved',
            meta: [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
        );
    }

    public function storeOperationsCalendarEvent(StoreOperationsCalendarEventRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $event = OperationsCalendarEvent::query()->create([
            ...$validated,
            'starts_at' => $validated['starts_at'] ?? $validated['date'],
            'ends_at' => $validated['ends_at'] ?? null,
            'all_day' => $validated['all_day'] ?? true,
            'type' => $validated['type'] ?? 'manual',
            'status' => $validated['status'] ?? 'scheduled',
            'created_by' => $request->user()->id,
        ]);

        return $this->success(
            data: $this->formatCustomCalendarEvent($event->fresh(['assignedEmployee:id,name,role'])),
            message: 'Operations calendar event created',
            status: 201,
        );
    }

    public function updateOperationsCalendarEvent(
        UpdateOperationsCalendarEventRequest $request,
        OperationsCalendarEvent $event,
    ): JsonResponse {
        $validated = $request->validated();

        $event->update([
            ...$validated,
            'starts_at' => $validated['starts_at'] ?? $validated['date'],
            'ends_at' => $validated['ends_at'] ?? null,
            'all_day' => $validated['all_day'] ?? true,
            'type' => $validated['type'] ?? 'manual',
            'status' => $validated['status'] ?? 'scheduled',
        ]);

        return $this->success(
            data: $this->formatCustomCalendarEvent($event->fresh(['assignedEmployee:id,name,role'])),
            message: 'Operations calendar event updated',
        );
    }

    public function destroyOperationsCalendarEvent(OperationsCalendarEvent $event): JsonResponse
    {
        $event->delete();

        return $this->success(
            data: null,
            message: 'Operations calendar event deleted',
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

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function customCalendarEvents(CarbonImmutable $from, CarbonImmutable $to)
    {
        return OperationsCalendarEvent::query()
            ->with('assignedEmployee:id,name,role')
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->orderBy('date')
            ->get()
            ->map(fn (OperationsCalendarEvent $event): array => $this->formatCustomCalendarEvent($event));
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function generatedCalendarEvents(CarbonImmutable $from, CarbonImmutable $to)
    {
        $renewals = Subscription::query()
            ->with(['member:id,name', 'plan:id,name'])
            ->where('status', 'active')
            ->whereBetween('end_date', [$from->toDateString(), $to->toDateString()])
            ->orderBy('end_date')
            ->limit(80)
            ->get()
            ->map(fn (Subscription $subscription): array => [
                'id' => 'renewal-'.$subscription->id,
                'source_id' => $subscription->id,
                'source' => 'subscription',
                'date' => $subscription->end_date?->toDateString(),
                'start' => $subscription->end_date?->toDateString(),
                'end' => null,
                'all_day' => true,
                'title' => ($subscription->member?->name ?? 'Member').' renewal due',
                'type' => 'renewal',
                'status' => 'scheduled',
                'notes' => $subscription->plan?->name,
                'editable' => false,
                'location' => null,
                'assigned_employee' => null,
            ]);

        $payroll = Payroll::query()
            ->with('employee:id,name,role')
            ->where('status', 'pending')
            ->latest()
            ->limit(50)
            ->get()
            ->map(function (Payroll $row): array {
                $date = CarbonImmutable::parse($row->month.'-01')->endOfMonth()->toDateString();

                return [
                    'id' => 'payroll-'.$row->id,
                    'source_id' => $row->id,
                    'source' => 'payroll',
                    'date' => $date,
                    'start' => $date,
                    'end' => null,
                    'all_day' => true,
                    'title' => ($row->employee?->name ?? 'Employee').' salary receipt',
                    'type' => 'payroll',
                    'status' => 'scheduled',
                    'notes' => 'Pending payroll for '.$row->month,
                    'editable' => false,
                    'location' => null,
                    'assigned_employee' => $row->employee ? [
                        'id' => $row->employee->id,
                        'name' => $row->employee->name,
                        'role' => $row->employee->role,
                    ] : null,
                ];
            })
            ->filter(fn (array $event): bool => $event['date'] >= $from->toDateString() && $event['date'] <= $to->toDateString());

        $inventory = Product::query()
            ->lowStock()
            ->active()
            ->orderBy('stock_quantity')
            ->limit(30)
            ->get()
            ->map(fn (Product $product): array => [
                'id' => 'inventory-'.$product->id,
                'source_id' => $product->id,
                'source' => 'product',
                'date' => now()->toDateString(),
                'start' => now()->toDateString(),
                'end' => null,
                'all_day' => true,
                'title' => 'Restock '.$product->name,
                'type' => 'inventory',
                'status' => 'scheduled',
                'notes' => $product->stock_quantity.' left in stock',
                'editable' => false,
                'location' => null,
                'assigned_employee' => null,
            ]);

        $attendance = AttendanceViolation::query()
            ->with('employee:id,name,role')
            ->where('status', 'pending')
            ->whereBetween('violation_date', [$from->toDateString(), $to->toDateString()])
            ->orderBy('violation_date')
            ->limit(50)
            ->get()
            ->map(fn (AttendanceViolation $violation): array => [
                'id' => 'attendance-'.$violation->id,
                'source_id' => $violation->id,
                'source' => 'attendance_violation',
                'date' => $violation->violation_date?->toDateString(),
                'start' => $violation->violation_date?->toDateString(),
                'end' => null,
                'all_day' => true,
                'title' => 'Review '.$violation->employee?->name.' warning',
                'type' => 'attendance',
                'status' => 'scheduled',
                'notes' => $violation->notes,
                'editable' => false,
                'location' => null,
                'assigned_employee' => $violation->employee ? [
                    'id' => $violation->employee->id,
                    'name' => $violation->employee->name,
                    'role' => $violation->employee->role,
                ] : null,
            ]);

        return collect()
            ->merge($renewals)
            ->merge($payroll)
            ->merge($inventory)
            ->merge($attendance)
            ->filter(fn (array $event): bool => filled($event['date']));
    }

    /**
     * @return array<string, mixed>
     */
    private function formatCustomCalendarEvent(OperationsCalendarEvent $event): array
    {
        return [
            'id' => $event->id,
            'source_id' => $event->id,
            'source' => 'custom',
            'date' => $event->date?->toDateString(),
            'start' => $event->starts_at?->toIso8601String() ?? $event->date?->toDateString(),
            'end' => $event->ends_at?->toIso8601String(),
            'all_day' => $event->all_day,
            'title' => $event->title,
            'type' => $event->type,
            'status' => $event->status,
            'notes' => $event->notes,
            'editable' => true,
            'location' => $event->location,
            'assigned_employee' => $event->assignedEmployee ? [
                'id' => $event->assignedEmployee->id,
                'name' => $event->assignedEmployee->name,
                'role' => $event->assignedEmployee->role,
            ] : null,
        ];
    }
}
