<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Expenses\StoreExpense;
use App\Actions\Expenses\UpdateExpense;
use App\Http\Requests\Expenses\StoreExpenseRequest;
use App\Http\Requests\Expenses\UpdateExpenseRequest;
use App\Http\Resources\ExpenseResource;
use App\Models\Expense;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

final class ExpenseController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $this->authorize('viewAny', Expense::class);

        $query = QueryBuilder::for(Expense::class)
            ->with(['creator'])
            ->allowedFilters(
                AllowedFilter::exact('category'),
                AllowedFilter::callback('start_date', function ($query, $value): void {
                    $query->where('date', '>=', $value);
                }),
                AllowedFilter::callback('end_date', function ($query, $value): void {
                    $query->where('date', '<=', $value);
                })
            )
            ->allowedSorts('date', 'amount', 'created_at')
            ->defaultSort('-date');

        // Calculate total amount of filtered expenses before pagination
        $totalAmount = (string) $query->clone()->sum('amount');

        $expenses = $query->paginate(15)
            ->withQueryString();

        return $this->success(
            data: ExpenseResource::collection($expenses->getCollection())->resolve(),
            message: 'Expenses retrieved',
            meta: [
                'current_page' => $expenses->currentPage(),
                'per_page' => $expenses->perPage(),
                'total' => $expenses->total(),
                'last_page' => $expenses->lastPage(),
                'total_amount' => number_format((float) $totalAmount, 2, '.', ''),
            ],
        );
    }

    public function store(StoreExpenseRequest $request, StoreExpense $action): JsonResponse
    {
        $expense = $action->handle($request->validated(), $request->user());

        return (new ExpenseResource($expense))
            ->withMessage('Expense created')
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, Expense $expense): JsonResponse
    {
        $this->authorize('view', $expense);
        $expense->load('creator');

        return (new ExpenseResource($expense))
            ->withMessage('Expense retrieved')
            ->response()
            ->setStatusCode(200);
    }

    public function update(UpdateExpenseRequest $request, Expense $expense, UpdateExpense $action): JsonResponse
    {
        $expense = $action->handle($expense, $request->validated());

        return (new ExpenseResource($expense))
            ->withMessage('Expense updated')
            ->response()
            ->setStatusCode(200);
    }

    public function destroy(Request $request, Expense $expense): JsonResponse
    {
        $this->authorize('delete', $expense);

        $expense->delete();

        return response()->json(null, 204);
    }
}
