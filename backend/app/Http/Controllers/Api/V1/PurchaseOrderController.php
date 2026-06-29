<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\PurchaseOrders\CreatePurchaseOrder;
use App\Actions\PurchaseOrders\ReceivePurchaseOrder;
use App\Http\Requests\PurchaseOrders\ReceivePurchaseOrderRequest;
use App\Http\Requests\PurchaseOrders\StorePurchaseOrderRequest;
use App\Http\Resources\PurchaseOrderResource;
use App\Models\PurchaseOrder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class PurchaseOrderController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $request->user()->can('products.view') || abort(403);

        $purchaseOrders = QueryBuilder::for(PurchaseOrder::class)
            ->with(['items.product'])
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::callback('search', function ($query, $value): void {
                    $query->where(function ($subQuery) use ($value): void {
                        $subQuery->where('reference', 'like', "%{$value}%")
                            ->orWhere('supplier_name', 'like', "%{$value}%");
                    });
                }),
            )
            ->allowedSorts('ordered_at', 'expected_at', 'subtotal', 'created_at')
            ->defaultSort('-created_at')
            ->paginate(15)
            ->withQueryString();

        return $this->success(
            data: PurchaseOrderResource::collection($purchaseOrders->getCollection())->resolve(),
            message: 'Purchase orders retrieved',
            meta: [
                'current_page' => $purchaseOrders->currentPage(),
                'per_page' => $purchaseOrders->perPage(),
                'total' => $purchaseOrders->total(),
                'last_page' => $purchaseOrders->lastPage(),
            ],
        );
    }

    public function store(StorePurchaseOrderRequest $request, CreatePurchaseOrder $action): JsonResponse
    {
        $purchaseOrder = $action->handle([
            ...$request->validated(),
            'created_by' => $request->user()->id,
        ]);

        return (new PurchaseOrderResource($purchaseOrder))
            ->withMessage('Purchase order created')
            ->response()
            ->setStatusCode(201);
    }

    public function show(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $request->user()->can('products.view') || abort(403);

        return (new PurchaseOrderResource($purchaseOrder->load(['items.product'])))
            ->withMessage('Purchase order retrieved')
            ->response()
            ->setStatusCode(200);
    }

    public function receive(
        ReceivePurchaseOrderRequest $request,
        PurchaseOrder $purchaseOrder,
        ReceivePurchaseOrder $action,
    ): JsonResponse {
        $purchaseOrder = $action->handle($purchaseOrder, [
            ...$request->validated(),
            'received_by' => $request->user()->id,
        ]);

        return (new PurchaseOrderResource($purchaseOrder))
            ->withMessage('Purchase order received')
            ->response()
            ->setStatusCode(200);
    }
}
