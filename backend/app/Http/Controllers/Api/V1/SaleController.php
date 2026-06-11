<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Reports\DailySalesReport;
use App\Actions\Reports\PeriodSalesReport;
use App\Actions\Sales\CreateSaleAction;
use App\Actions\Sales\GenerateReceipt;
use App\Actions\Sales\VoidSaleAction;
use App\Http\Requests\Sales\DailySalesRequest;
use App\Http\Requests\Sales\PeriodSalesRequest;
use App\Http\Requests\Sales\StoreSaleRequest;
use App\Http\Requests\Sales\VoidSaleRequest;
use App\Http\Resources\SaleResource;
use App\Models\Sale;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;
use Symfony\Component\HttpFoundation\Response;

/**
 * US2 — POS Checkout & Sale Creation
 */
class SaleController extends ApiController
{
    /**
     * GET /api/v1/sales
     */
    public function index(): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Sale::class);

        $sales = QueryBuilder::for(Sale::class)
            ->with(['items.product', 'payment', 'member', 'soldBy'])
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::exact('member_id'),
                AllowedFilter::exact('sold_by_user_id'),
                AllowedFilter::exact('payment_method')
            )
            ->allowedSorts('created_at', 'total', 'subtotal')
            ->paginate(15);

        return SaleResource::collection($sales)
            ->additional([
                'meta' => [
                    'current_page' => $sales->currentPage(),
                    'per_page' => $sales->perPage(),
                    'total' => $sales->total(),
                    'last_page' => $sales->lastPage(),
                ],
                'message' => 'Sales retrieved',
            ]);
    }

    /**
     * POST /api/v1/sales
     */
    public function store(StoreSaleRequest $request, CreateSaleAction $action): JsonResponse
    {
        $sale = $action->execute($request->validated(), $request->user());

        return (new SaleResource($sale))
            ->withMessage('Sale created')
            ->response()
            ->setStatusCode(201);
    }

    /**
     * GET /api/v1/sales/{sale}
     */
    public function show(Sale $sale): JsonResponse
    {
        $this->authorize('view', $sale);

        $sale->load(['items.product', 'payment', 'member', 'soldBy']);

        return (new SaleResource($sale))
            ->withMessage('Sale retrieved')
            ->response()
            ->setStatusCode(200);
    }

    /**
     * POST /api/v1/sales/{sale}/void
     */
    public function void(VoidSaleRequest $request, Sale $sale, VoidSaleAction $action): JsonResponse
    {
        $sale = $action->execute($sale, $request->validated(), $request->user());

        return (new SaleResource($sale))
            ->withMessage('Sale voided')
            ->response()
            ->setStatusCode(200);
    }

    /**
     * GET /api/v1/sales/{sale}/receipt
     */
    public function receipt(Sale $sale, GenerateReceipt $action): Response
    {
        $this->authorize('view', $sale);

        return $action->execute($sale, request()->header('Accept', ''));
    }

    /**
     * GET /api/v1/sales/daily
     */
    public function daily(DailySalesRequest $request, DailySalesReport $action): JsonResponse
    {
        $date = $request->input('date', now()->toDateString());
        $result = $action->execute($date);

        return response()->json([
            'data' => [
                'total_revenue' => $result['total_revenue'],
                'sales' => SaleResource::collection($result['sales']),
            ],
            'meta' => (object) [],
            'message' => 'Daily sales report retrieved',
        ]);
    }

    /**
     * GET /api/v1/sales/report
     */
    public function report(PeriodSalesRequest $request, PeriodSalesReport $action): JsonResponse
    {
        $results = $action->execute($request->validated());

        return response()->json([
            'data' => $results,
            'meta' => (object) [],
            'message' => 'Period sales report retrieved',
        ]);
    }
}
