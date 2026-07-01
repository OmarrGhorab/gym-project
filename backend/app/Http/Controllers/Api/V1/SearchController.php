<?php

namespace App\Http\Controllers\Api\V1;

use App\Models\Employee;
use App\Models\GymTask;
use App\Models\Member;
use App\Models\Product;
use App\Models\Subscription;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SearchController extends ApiController
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:80'],
            'limit' => ['nullable', 'integer', 'min:3', 'max:12'],
        ]);

        $query = trim($validated['q']);
        $limit = (int) ($validated['limit'] ?? 5);
        $user = $request->user();

        $results = collect();

        if ($user->can('viewAny', Member::class)) {
            $results = $results->merge($this->members($query, $limit));
        }

        if ($user->can('viewAny', Subscription::class)) {
            $results = $results->merge($this->subscriptions($query, $limit));
        }

        if ($user->can('viewAny', Employee::class)) {
            $results = $results->merge($this->employees($query, $limit));
        }

        if ($user->can('viewAny', Product::class)) {
            $results = $results->merge($this->products($query, $limit));
        }

        if ($user->can('reports.view')) {
            $results = $results->merge($this->tasks($query, $limit));
        }

        return $this->success(
            data: $results
                ->sortBy(['group', 'title'])
                ->values()
                ->take($limit * 5)
                ->all(),
            message: 'Search results retrieved',
            meta: ['query' => $query],
        );
    }

    private function like(string $value): string
    {
        return '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value).'%';
    }

    private function startsWith(string $value): string
    {
        return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $value).'%';
    }

    private function members(string $query, int $limit)
    {
        $like = $this->like($query);
        $startsWith = $this->startsWith($query);

        return Member::query()
            ->select(['id', 'name', 'phone', 'status'])
            ->where(function (Builder $builder) use ($like, $startsWith): void {
                $builder->where('name', 'like', $like)
                    ->orWhere('phone', 'like', $startsWith)
                    ->orWhere('phone', 'like', '+'.$startsWith)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('national_id', 'like', $startsWith);
            })
            ->orderByRaw('case when name like ? then 0 else 1 end', [$startsWith])
            ->orderBy('name')
            ->limit($limit)
            ->get()
            ->map(fn (Member $member): array => [
                'id' => 'member-'.$member->id,
                'type' => 'member',
                'group' => 'Members',
                'title' => $member->name,
                'subtitle' => trim(($member->phone ? $member->phone.' · ' : '').ucfirst((string) $member->status), ' ·'),
                'url' => '/dashboard/members?q='.urlencode($member->phone ?: $member->name),
            ]);
    }

    private function subscriptions(string $query, int $limit)
    {
        $like = $this->like($query);

        return Subscription::query()
            ->with(['member:id,name,phone', 'plan:id,name'])
            ->where(function (Builder $builder) use ($like): void {
                $builder->whereHas('member', function (Builder $memberQuery) use ($like): void {
                    $memberQuery->where('name', 'like', $like)
                        ->orWhere('phone', 'like', $like);
                })->orWhereHas('plan', fn (Builder $planQuery) => $planQuery->where('name', 'like', $like));
            })
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn (Subscription $subscription): array => [
                'id' => 'subscription-'.$subscription->id,
                'type' => 'subscription',
                'group' => 'Memberships',
                'title' => $subscription->member?->name ?? 'Unknown member',
                'subtitle' => trim(($subscription->plan?->name ? $subscription->plan->name.' · ' : '').ucfirst((string) $subscription->status), ' ·'),
                'url' => '/dashboard/crm',
            ]);
    }

    private function employees(string $query, int $limit)
    {
        $like = $this->like($query);

        return Employee::query()
            ->select(['id', 'name', 'phone', 'role', 'status'])
            ->where(function (Builder $builder) use ($like): void {
                $builder->where('name', 'like', $like)
                    ->orWhere('phone', 'like', $like)
                    ->orWhere('role', 'like', $like);
            })
            ->orderBy('name')
            ->limit($limit)
            ->get()
            ->map(fn (Employee $employee): array => [
                'id' => 'employee-'.$employee->id,
                'type' => 'employee',
                'group' => 'Staff',
                'title' => $employee->name,
                'subtitle' => trim(ucfirst((string) $employee->role).' · '.ucfirst((string) $employee->status), ' ·'),
                'url' => '/dashboard/academy',
            ]);
    }

    private function products(string $query, int $limit)
    {
        $like = $this->like($query);

        return Product::query()
            ->select(['id', 'name', 'category', 'sku', 'stock_quantity'])
            ->where(function (Builder $builder) use ($like): void {
                $builder->where('name', 'like', $like)
                    ->orWhere('sku', 'like', $like)
                    ->orWhere('category', 'like', $like);
            })
            ->orderBy('name')
            ->limit($limit)
            ->get()
            ->map(fn (Product $product): array => [
                'id' => 'product-'.$product->id,
                'type' => 'product',
                'group' => 'Inventory',
                'title' => $product->name,
                'subtitle' => trim(($product->sku ? $product->sku.' · ' : '').$product->stock_quantity.' in stock', ' ·'),
                'url' => '/dashboard/logistics',
            ]);
    }

    private function tasks(string $query, int $limit)
    {
        $like = $this->like($query);

        return GymTask::query()
            ->select(['id', 'title', 'category', 'status', 'priority'])
            ->where(function (Builder $builder) use ($like): void {
                $builder->where('title', 'like', $like)
                    ->orWhere('category', 'like', $like)
                    ->orWhere('status', 'like', $like);
            })
            ->latest()
            ->limit($limit)
            ->get()
            ->map(fn (GymTask $task): array => [
                'id' => 'task-'.$task->id,
                'type' => 'task',
                'group' => 'Tasks',
                'title' => $task->title,
                'subtitle' => trim(ucfirst((string) $task->category).' · '.ucfirst((string) $task->status), ' ·'),
                'url' => '/dashboard/tasks',
            ]);
    }
}
