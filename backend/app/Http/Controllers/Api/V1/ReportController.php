<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Reports\ClassesPlansReport;
use App\Actions\Reports\CoachExtraPlansReport;
use App\Actions\Reports\EmployeePerformanceReport;
use App\Actions\Reports\FinanceDashboardSummary;
use App\Actions\Reports\FinancialReport;
use App\Actions\Reports\IncomeOutcomeReport;
use App\Actions\Reports\InventoryLogisticsSummary;
use App\Actions\Reports\LiveAttendanceSummary;
use App\Actions\Reports\OperationsSummary;
use App\Actions\Reports\PosDashboardSummary;
use App\Actions\Reports\ProductsFinanceReport;
use App\Actions\Reports\StaffAcademySummary;
use App\Actions\Reports\SubsShiftsReport;
use App\Actions\Reports\SystemHealthSummary;
use App\Actions\Settings\StoreSetting;
use App\Http\Requests\Reports\EmployeePerformanceRequest;
use App\Http\Requests\Reports\FinancialReportRequest;
use App\Http\Requests\Reports\StoreOperationsCalendarEventRequest;
use App\Http\Requests\Reports\UpdateOperationsCalendarEventRequest;
use App\Models\AttendanceViolation;
use App\Models\Employee;
use App\Models\OperationsCalendarEvent;
use App\Models\Payroll;
use App\Models\Product;
use App\Models\Subscription;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
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

    public function financeSummary(Request $request, FinanceDashboardSummary $action): JsonResponse
    {
        return $this->success(
            data: $action->execute($request->validate([
                'from' => ['nullable', 'date_format:Y-m-d'],
                'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
                'group_by' => ['nullable', 'string', Rule::in(['day', 'month'])],
            ])),
            message: 'Finance dashboard summary retrieved',
        );
    }

    public function liveAttendance(Request $request, LiveAttendanceSummary $action): JsonResponse
    {
        $request->user()->can('reports.view') || abort(403);

        return $this->success(
            data: $action->execute($request->validate([
                'date' => ['nullable', 'date'],
                'hours' => ['nullable', 'integer', 'min:6', 'max:24'],
                'audience' => ['nullable', 'string', Rule::in(['all', 'members', 'staff'])],
                'metric' => ['nullable', 'string', Rule::in(['occupancy', 'entries', 'alerts'])],
            ])),
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

    public function staffAcademy(Request $request, StaffAcademySummary $action): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        return $this->success(
            data: $action->execute($validated),
            message: 'Staff academy summary retrieved',
        );
    }

    public function coachExtraPlans(Request $request, CoachExtraPlansReport $action): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'coach_id' => ['nullable', 'integer', 'exists:employees,id'],
        ]);

        return $this->success(
            data: $action->execute($validated),
            message: 'Coach extra plans report retrieved',
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

    public function operationsCalendarEvents(Request $request, StoreSetting $settings): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'type' => ['nullable', 'string', Rule::in(['manual', 'shift', 'class', 'pt_session', 'training', 'meeting', 'sales', 'maintenance', 'cleaning', 'renewal', 'payroll', 'attendance', 'inventory', 'finance'])],
        ]);

        $from = CarbonImmutable::parse($validated['from'] ?? now()->startOfMonth())->startOfDay();
        $to = CarbonImmutable::parse($validated['to'] ?? now()->addMonthsNoOverflow(2)->endOfMonth())->endOfDay();
        $type = $validated['type'] ?? null;

        $events = collect()
            ->merge($this->customCalendarEvents($from, $to))
            ->merge($this->generatedCalendarEvents($from, $to, $settings))
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
        $assignedEmployeeIds = $this->normalizeAssignedEmployeeIds($validated);

        $event = OperationsCalendarEvent::query()->create([
            ...$validated,
            'starts_at' => $validated['starts_at'] ?? $validated['date'],
            'ends_at' => $validated['ends_at'] ?? null,
            'all_day' => $validated['all_day'] ?? true,
            'type' => $validated['type'] ?? 'manual',
            'custom_type_label' => $this->normalizeCustomTypeLabel($validated),
            'status' => $validated['status'] ?? 'scheduled',
            'assigned_employee_id' => $assignedEmployeeIds[0] ?? ($validated['assigned_employee_id'] ?? null),
            'assigned_employee_ids' => $assignedEmployeeIds,
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
        $assignedEmployeeIds = $this->normalizeAssignedEmployeeIds($validated);

        $event->update([
            ...$validated,
            'starts_at' => $validated['starts_at'] ?? $validated['date'],
            'ends_at' => $validated['ends_at'] ?? null,
            'all_day' => $validated['all_day'] ?? true,
            'type' => $validated['type'] ?? 'manual',
            'custom_type_label' => $this->normalizeCustomTypeLabel($validated),
            'status' => $validated['status'] ?? 'scheduled',
            'assigned_employee_id' => $assignedEmployeeIds[0] ?? ($validated['assigned_employee_id'] ?? null),
            'assigned_employee_ids' => $assignedEmployeeIds,
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

    public function classesPlans(Request $request, ClassesPlansReport $action): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'plan_id' => ['nullable', 'integer', 'exists:plans,id'],
            'status' => ['nullable', 'string'],
        ]);

        return $this->success(
            data: $action->execute($validated),
            message: 'Classes and plans report retrieved',
        );
    }

    public function productsFinance(Request $request, ProductsFinanceReport $action): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'category' => ['nullable', 'string'],
            'search' => ['nullable', 'string'],
            'payment_method' => ['nullable', 'string'],
        ]);

        return $this->success(
            data: $action->execute($validated),
            message: 'Products finance report retrieved',
        );
    }

    public function subsShifts(Request $request, SubsShiftsReport $action): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'created_by' => ['nullable', 'integer'],
            'status' => ['nullable', 'string'],
        ]);

        return $this->success(
            data: $action->execute($validated),
            message: 'Subscriptions and shifts report retrieved',
        );
    }

    public function incomeOutcome(Request $request, IncomeOutcomeReport $action): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'group_by' => ['nullable', 'string', Rule::in(['day', 'month'])],
        ]);

        return $this->success(
            data: $action->execute($validated),
            message: 'Income vs outcome report retrieved',
        );
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function customCalendarEvents(CarbonImmutable $from, CarbonImmutable $to)
    {
        $events = OperationsCalendarEvent::query()
            ->with('assignedEmployee:id,name,role')
            ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
            ->orderBy('date')
            ->get();
        $employeesById = $this->employeesByIdForCalendarEvents($events);

        return $events->map(fn (OperationsCalendarEvent $event): array => $this->formatCustomCalendarEvent($event, $employeesById));
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    private function generatedCalendarEvents(CarbonImmutable $from, CarbonImmutable $to, StoreSetting $settings)
    {
        $payrollScheduleMode = (string) ($settings->read('payroll.schedule_mode') ?? 'fixed');
        $defaultPayrollPayDay = (int) ($settings->read('payroll.default_pay_day') ?? 30);

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
                'custom_type_label' => null,
                'status' => 'scheduled',
                'notes' => $subscription->plan?->name,
                'editable' => false,
                'location' => null,
                'assigned_employee' => null,
                'assigned_employees' => [],
            ]);

        $payroll = Payroll::query()
            ->with('employee:id,name,role,pay_day')
            ->where('status', 'pending')
            ->latest()
            ->limit(50)
            ->get()
            ->map(function (Payroll $row) use ($payrollScheduleMode, $defaultPayrollPayDay): array {
                $date = $this->resolvePayrollDueDate(
                    $row->month,
                    $row->employee?->pay_day,
                    $payrollScheduleMode,
                    $defaultPayrollPayDay,
                );

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
                    'custom_type_label' => null,
                    'status' => 'scheduled',
                    'notes' => trim(
                        'Pending payroll for '.$row->month
                        .($row->employee?->pay_day ? ' · Pay day '.$row->employee->pay_day : '')
                    ),
                    'editable' => false,
                    'location' => null,
                    'assigned_employee' => $row->employee ? [
                        'id' => $row->employee->id,
                        'name' => $row->employee->name,
                        'role' => $row->employee->role,
                    ] : null,
                    'assigned_employees' => $row->employee ? [[
                        'id' => $row->employee->id,
                        'name' => $row->employee->name,
                        'role' => $row->employee->role,
                    ]] : [],
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
                'custom_type_label' => null,
                'status' => 'scheduled',
                'notes' => $product->stock_quantity.' left in stock',
                'editable' => false,
                'location' => null,
                'assigned_employee' => null,
                'assigned_employees' => [],
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
                'custom_type_label' => null,
                'status' => 'scheduled',
                'notes' => $violation->notes,
                'editable' => false,
                'location' => null,
                'assigned_employee' => $violation->employee ? [
                    'id' => $violation->employee->id,
                    'name' => $violation->employee->name,
                    'role' => $violation->employee->role,
                ] : null,
                'assigned_employees' => $violation->employee ? [[
                    'id' => $violation->employee->id,
                    'name' => $violation->employee->name,
                    'role' => $violation->employee->role,
                ]] : [],
            ]);

        return collect()
            ->merge($renewals)
            ->merge($payroll)
            ->merge($inventory)
            ->merge($attendance)
            ->filter(fn (array $event): bool => filled($event['date']));
    }

    private function resolvePayrollDueDate(string $month, ?int $employeePayDay, string $scheduleMode, int $defaultPayDay): string
    {
        $day = $scheduleMode === 'per_employee' && $employeePayDay ? $employeePayDay : $defaultPayDay;
        $day = max(1, min(31, $day));
        $monthStart = CarbonImmutable::parse($month.'-01');
        $lastDay = (int) $monthStart->endOfMonth()->format('j');

        return $monthStart->day(min($day, $lastDay))->toDateString();
    }

    /**
     * @return array<string, mixed>
     */
    private function formatCustomCalendarEvent(OperationsCalendarEvent $event, ?Collection $employeesById = null): array
    {
        $assignedEmployees = $this->formatAssignedEmployees($event, $employeesById);

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
            'custom_type_label' => $event->custom_type_label,
            'status' => $event->status,
            'notes' => $event->notes,
            'editable' => true,
            'location' => $event->location,
            'assigned_employee' => $assignedEmployees[0] ?? null,
            'assigned_employees' => $assignedEmployees,
        ];
    }

    /**
     * @param  array<string, mixed>  $validated
     * @return list<int>
     */
    private function normalizeAssignedEmployeeIds(array $validated): array
    {
        $ids = Arr::wrap($validated['assigned_employee_ids'] ?? []);

        if ($ids === [] && isset($validated['assigned_employee_id']) && $validated['assigned_employee_id'] !== null) {
            $ids = [$validated['assigned_employee_id']];
        }

        return collect($ids)
            ->map(fn (mixed $id): int => (int) $id)
            ->filter(fn (int $id): bool => $id > 0)
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @param  array<string, mixed>  $validated
     */
    private function normalizeCustomTypeLabel(array $validated): ?string
    {
        $label = trim((string) ($validated['custom_type_label'] ?? ''));

        if (($validated['type'] ?? 'manual') !== 'manual') {
            return null;
        }

        return $label !== '' ? $label : null;
    }

    /**
     * @param  Collection<int, OperationsCalendarEvent>  $events
     * @return Collection<int, Employee>
     */
    private function employeesByIdForCalendarEvents(Collection $events): Collection
    {
        $ids = $events
            ->flatMap(fn (OperationsCalendarEvent $event) => $event->assigned_employee_ids ?? ($event->assigned_employee_id ? [$event->assigned_employee_id] : []))
            ->map(fn (mixed $id): int => (int) $id)
            ->filter()
            ->unique()
            ->values();

        if ($ids->isEmpty()) {
            return collect();
        }

        return Employee::query()
            ->whereIn('id', $ids->all())
            ->get(['id', 'name', 'role'])
            ->keyBy('id');
    }

    /**
     * @return list<array{id:int,name:string,role:?string}>
     */
    private function formatAssignedEmployees(OperationsCalendarEvent $event, ?Collection $employeesById = null): array
    {
        $assignedIds = collect($event->assigned_employee_ids ?? [])
            ->map(fn (mixed $id): int => (int) $id)
            ->filter()
            ->values();

        if ($assignedIds->isEmpty() && $event->assignedEmployee) {
            $assignedIds = collect([$event->assignedEmployee->id]);
        }

        if (! $employeesById && $assignedIds->isNotEmpty()) {
            $employeesById = Employee::query()
                ->whereIn('id', $assignedIds->all())
                ->get(['id', 'name', 'role'])
                ->keyBy('id');
        }

        return $assignedIds
            ->map(function (int $id) use ($employeesById, $event): ?array {
                $employee = $employeesById?->get($id);

                if (! $employee && $event->assignedEmployee?->id === $id) {
                    $employee = $event->assignedEmployee;
                }

                if (! $employee) {
                    return null;
                }

                return [
                    'id' => $employee->id,
                    'name' => $employee->name,
                    'role' => $employee->role,
                ];
            })
            ->filter()
            ->values()
            ->all();
    }
}
