<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Requests\GymTasks\StoreGymTaskRequest;
use App\Http\Requests\GymTasks\UpdateGymTaskRequest;
use App\Models\Attendance;
use App\Models\GymTask;
use App\Models\GymTaskComment;
use App\Models\Payment;
use App\Models\Payroll;
use App\Models\Product;
use App\Models\Subscription;
use App\Services\OperationalNotifier;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class GymTaskController extends ApiController
{
    public function index(): JsonResponse
    {
        $manual = GymTask::query()
            ->with('assignedEmployee:id,name,role')
            ->withCount('comments')
            ->latest()
            ->get()
            ->map(fn (GymTask $task): array => $this->formatTask($task));

        return $this->success(
            data: collect($manual->all())->merge($this->generatedTasks())->values()->all(),
            message: 'Gym tasks retrieved',
        );
    }

    public function store(StoreGymTaskRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $task = GymTask::query()->create([
            ...$validated,
            'status' => $validated['status'] ?? 'planned',
            'priority' => $validated['priority'] ?? 'medium',
            'category' => $validated['category'] ?? 'operations',
            'progress' => $validated['progress'] ?? 0,
            'created_by' => $request->user()->id,
        ]);
        app(OperationalNotifier::class)->taskAssigned($task);
        $task->loadMissing('assignedEmployee');
        activity('tasks')
            ->causedBy($request->user())
            ->performedOn($task)
            ->event('assigned')
            ->withProperties([
                'task_id' => $task->id,
                'task_title' => $task->title,
                'assigned_employee_id' => $task->assigned_employee_id,
                'assigned_employee_name' => $task->assignedEmployee?->name,
                'priority' => $task->priority,
                'due_date' => $task->due_date?->toDateString(),
            ])
            ->log($request->user()->name.' assigned task "'.$task->title.'" to '.($task->assignedEmployee?->name ?? 'unassigned'));

        return $this->success(
            data: $this->formatTask($task->fresh(['assignedEmployee:id,name,role'])->loadCount('comments')),
            message: 'Gym task created',
            status: 201,
        );
    }

    public function update(UpdateGymTaskRequest $request, GymTask $gymTask): JsonResponse
    {
        $previousAssignedEmployeeId = $gymTask->assigned_employee_id;
        $gymTask->update($request->validated());

        if ($gymTask->assigned_employee_id && $gymTask->assigned_employee_id !== $previousAssignedEmployeeId) {
            app(OperationalNotifier::class)->taskAssigned($gymTask);
            $gymTask->loadMissing('assignedEmployee');
            activity('tasks')
                ->causedBy($request->user())
                ->performedOn($gymTask)
                ->event('assigned')
                ->withProperties([
                    'task_id' => $gymTask->id,
                    'task_title' => $gymTask->title,
                    'assigned_employee_id' => $gymTask->assigned_employee_id,
                    'assigned_employee_name' => $gymTask->assignedEmployee?->name,
                ])
                ->log($request->user()->name.' reassigned task "'.$gymTask->title.'" to '.$gymTask->assignedEmployee?->name);
        }

        return $this->success(
            data: $this->formatTask($gymTask->fresh(['assignedEmployee:id,name,role'])->loadCount('comments')),
            message: 'Gym task updated',
        );
    }

    public function show(GymTask $gymTask): JsonResponse
    {
        $gymTask->load([
            'assignedEmployee:id,name,role',
            'comments.user:id,name,email',
        ])->loadCount('comments');

        return $this->success(
            data: [
                ...$this->formatTask($gymTask),
                'comments' => $gymTask->comments
                    ->sortBy('created_at')
                    ->values()
                    ->map(fn (GymTaskComment $comment): array => [
                        'id' => $comment->id,
                        'body' => $comment->body,
                        'created_at' => $comment->created_at?->toIso8601String(),
                        'user' => $comment->user ? [
                            'id' => $comment->user->id,
                            'name' => $comment->user->name,
                            'email' => $comment->user->email,
                        ] : null,
                    ])
                    ->all(),
            ],
            message: 'Gym task retrieved',
        );
    }

    public function storeComment(GymTask $gymTask): JsonResponse
    {
        $validated = request()->validate([
            'body' => ['required', 'string', 'max:2000'],
        ]);

        $comment = $gymTask->comments()->create([
            'body' => $validated['body'],
            'user_id' => request()->user()->id,
        ]);

        $comment->load('user:id,name,email');

        return $this->success(
            data: [
                'id' => $comment->id,
                'body' => $comment->body,
                'created_at' => $comment->created_at?->toIso8601String(),
                'user' => $comment->user ? [
                    'id' => $comment->user->id,
                    'name' => $comment->user->name,
                    'email' => $comment->user->email,
                ] : null,
            ],
            message: 'Gym task comment created',
            status: 201,
        );
    }

    public function destroy(GymTask $gymTask): JsonResponse
    {
        $gymTask->delete();

        return $this->success(message: 'Gym task deleted');
    }

    private function formatTask(GymTask $task): array
    {
        return [
            'id' => 'manual-'.$task->id,
            'source_id' => $task->id,
            'source' => 'manual',
            'title' => $task->title,
            'description' => $task->description,
            'status' => $task->status,
            'priority' => $task->priority,
            'category' => $task->category,
            'progress' => $task->progress,
            'due_date' => $task->due_date?->toDateString(),
            'editable' => true,
            'href' => null,
            'assigned_employee' => $task->assignedEmployee ? [
                'id' => $task->assignedEmployee->id,
                'name' => $task->assignedEmployee->name,
                'role' => $task->assignedEmployee->role,
            ] : null,
            'metrics' => [
                'comments' => (int) ($task->comments_count ?? 0),
                'documents' => 0,
                'attachments' => 0,
            ],
        ];
    }

    private function generatedTasks()
    {
        $today = CarbonImmutable::today();

        $attendance = Attendance::query()
            ->with('employee:id,name,role')
            ->whereNotNull('check_in')
            ->whereNull('check_out')
            ->orderBy('date')
            ->limit(20)
            ->get()
            ->map(fn (Attendance $row): array => [
                'id' => 'attendance-'.$row->id,
                'source_id' => $row->id,
                'source' => 'attendance',
                'title' => 'Close out '.$row->employee?->name."'s attendance",
                'description' => $row->notes ?? 'Checked in with no check-out recorded.',
                'status' => 'review',
                'priority' => 'high',
                'category' => 'attendance',
                'progress' => 75,
                'due_date' => $row->date?->toDateString(),
                'editable' => false,
                'href' => '/dashboard/attendance',
                'assigned_employee' => $row->employee ? [
                    'id' => $row->employee->id,
                    'name' => $row->employee->name,
                    'role' => $row->employee->role,
                ] : null,
                'metrics' => ['comments' => 1, 'documents' => 0, 'attachments' => 0],
            ]);

        $renewals = Subscription::query()
            ->with(['member:id,name', 'plan:id,name'])
            ->where('status', 'active')
            ->whereBetween('end_date', [$today->toDateString(), $today->addDays(7)->toDateString()])
            ->orderBy('end_date')
            ->limit(20)
            ->get()
            ->map(fn (Subscription $subscription): array => [
                'id' => 'renewal-'.$subscription->id,
                'source_id' => $subscription->id,
                'source' => 'subscription',
                'title' => 'Call '.$subscription->member?->name.' for renewal',
                'description' => ($subscription->plan?->name ?? 'Subscription').' ends soon. Confirm renewal or payment plan.',
                'status' => 'planned',
                'priority' => 'medium',
                'category' => 'membership',
                'progress' => 20,
                'due_date' => $subscription->end_date?->toDateString(),
                'editable' => false,
                'href' => '/dashboard/crm',
                'assigned_employee' => null,
                'metrics' => ['comments' => 0, 'documents' => 1, 'attachments' => 0],
            ]);

        $payroll = Payroll::query()
            ->with('employee:id,name,role')
            ->where('status', 'pending')
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn (Payroll $row): array => [
                'id' => 'payroll-'.$row->id,
                'source_id' => $row->id,
                'source' => 'payroll',
                'title' => 'Approve '.$row->employee?->name.' salary receipt',
                'description' => 'Review payroll month '.$row->month.' with attendance deductions before payment.',
                'status' => 'review',
                'priority' => 'high',
                'category' => 'payroll',
                'progress' => 80,
                'due_date' => CarbonImmutable::parse($row->month.'-01')->endOfMonth()->toDateString(),
                'editable' => false,
                'href' => '/dashboard/payroll',
                'assigned_employee' => $row->employee ? [
                    'id' => $row->employee->id,
                    'name' => $row->employee->name,
                    'role' => $row->employee->role,
                ] : null,
                'metrics' => ['comments' => 0, 'documents' => 2, 'attachments' => 0],
            ]);

        $inventory = Product::query()
            ->lowStock()
            ->active()
            ->orderBy('stock_quantity')
            ->limit(20)
            ->get()
            ->map(fn (Product $product): array => [
                'id' => 'inventory-'.$product->id,
                'source_id' => $product->id,
                'source' => 'product',
                'title' => 'Restock '.$product->name,
                'description' => $product->stock_quantity.' left in stock. Create purchase order or adjust stock.',
                'status' => 'planned',
                'priority' => 'medium',
                'category' => 'inventory',
                'progress' => 10,
                'due_date' => $today->addDay()->toDateString(),
                'editable' => false,
                'href' => '/dashboard/logistics',
                'assigned_employee' => null,
                'metrics' => ['comments' => 0, 'documents' => 0, 'attachments' => 1],
            ]);

        $paidTotals = Payment::query()
            ->selectRaw('payable_id, SUM(amount) as paid_total')
            ->where('payable_type', Subscription::class)
            ->groupBy('payable_id');

        $dues = Subscription::query()
            ->with(['member:id,name', 'plan:id,name'])
            ->leftJoinSub($paidTotals, 'paid_totals', 'paid_totals.payable_id', '=', 'subscriptions.id')
            ->select('subscriptions.*')
            ->selectRaw('COALESCE(paid_totals.paid_total, 0) as paid_total')
            ->whereRaw('subscriptions.price_paid > COALESCE(paid_totals.paid_total, 0)')
            ->orderBy('end_date')
            ->limit(20)
            ->get()
            ->map(fn (Subscription $subscription): array => [
                'id' => 'due-'.$subscription->id,
                'source_id' => $subscription->id,
                'source' => 'due',
                'title' => 'Collect dues from '.$subscription->member?->name,
                'description' => ($subscription->plan?->name ?? 'Subscription').' has outstanding balance.',
                'status' => 'doing',
                'priority' => 'medium',
                'category' => 'finance',
                'progress' => 45,
                'due_date' => $subscription->end_date?->toDateString(),
                'editable' => false,
                'href' => '/dashboard/finance',
                'assigned_employee' => null,
                'metrics' => ['comments' => 1, 'documents' => 1, 'attachments' => 0],
            ]);

        return collect()->merge($attendance)->merge($renewals)->merge($payroll)->merge($inventory)->merge($dues);
    }
}
