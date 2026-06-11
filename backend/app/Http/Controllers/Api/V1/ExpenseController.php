<?php

namespace App\Http\Controllers\Api\V1;

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

        $expenses = $query->cursorPaginate(15)
            ->withQueryString();

        return $this->success(
            data: ExpenseResource::collection($expenses->getCollection())->resolve(),
            message: 'Expenses retrieved',
            meta: [
                'next_cursor' => $expenses->nextCursor()?->encode(),
                'prev_cursor' => $expenses->previousCursor()?->encode(),
                'per_page' => $expenses->perPage(),
                'total_amount' => number_format((float) $totalAmount, 2, '.', ''),
            ],
        );
    }

    public function store(StoreExpenseRequest $request): JsonResponse
    {
        $data = $request->validated();
        $data['created_by'] = $request->user()->id;

        $expense = Expense::create($data);
        $expense->load('creator');

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

    public function update(UpdateExpenseRequest $request, Expense $expense): JsonResponse
    {
        $expense->update($request->validated());
        $expense->load('creator');

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
