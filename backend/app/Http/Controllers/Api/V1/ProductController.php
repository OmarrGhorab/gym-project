<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Products\AdjustStock;
use App\Actions\Products\StoreProduct;
use App\Actions\Products\ToggleProduct;
use App\Actions\Products\UpdateProduct;
use App\Http\Requests\Products\AdjustStockRequest;
use App\Http\Requests\Products\StoreProductRequest;
use App\Http\Requests\Products\UpdateProductRequest;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\Storage;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;
use Symfony\Component\HttpFoundation\Response;

/**
 * US1 — Product Catalog Management
 */
class ProductController extends ApiController
{
    /**
     * GET /api/v1/products
     */
    public function index(): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Product::class);

        $products = QueryBuilder::for(Product::class)
            ->allowedFilters(
                AllowedFilter::exact('is_active'),
                AllowedFilter::exact('category'),
                AllowedFilter::scope('is_low_stock', 'lowStock'),
                AllowedFilter::scope('search')
            )
            ->allowedSorts('name', 'price', 'stock_quantity', 'created_at')
            ->paginate(15);

        return ProductResource::collection($products)
            ->additional([
                'meta' => [
                    'current_page' => $products->currentPage(),
                    'per_page' => $products->perPage(),
                    'total' => $products->total(),
                    'last_page' => $products->lastPage(),
                ],
                'message' => 'Products retrieved',
            ]);
    }

    /**
     * POST /api/v1/products
     */
    public function store(StoreProductRequest $request, StoreProduct $action): JsonResponse
    {
        $product = $action->handle($request->validated());

        return (new ProductResource($product))
            ->withMessage('Product created')
            ->response()
            ->setStatusCode(201);
    }

    /**
     * GET /api/v1/products/{product}
     */
    public function show(Product $product): JsonResponse
    {
        $this->authorize('view', $product);

        return (new ProductResource($product))
            ->withMessage('Product retrieved')
            ->response()
            ->setStatusCode(200);
    }

    /**
     * PUT /api/v1/products/{product}
     */
    public function update(UpdateProductRequest $request, Product $product, UpdateProduct $action): JsonResponse
    {
        $product = $action->handle($product, $request->validated());

        return (new ProductResource($product))
            ->withMessage('Product updated')
            ->response()
            ->setStatusCode(200);
    }

    /**
     * PATCH /api/v1/products/{product}/toggle
     */
    public function toggle(Product $product, ToggleProduct $action): JsonResponse
    {
        $this->authorize('update', $product);

        $product = $action->handle($product);

        return (new ProductResource($product))
            ->withMessage('Product status toggled')
            ->response()
            ->setStatusCode(200);
    }

    /**
     * POST /api/v1/products/{product}/stock
     */
    public function adjustStock(AdjustStockRequest $request, Product $product, AdjustStock $action): JsonResponse
    {
        $data = array_merge($request->validated(), [
            'created_by' => $request->user()->id,
        ]);

        $product = $action->handle($product, $data);

        return (new ProductResource($product))
            ->withMessage('Product stock adjusted')
            ->response()
            ->setStatusCode(201);
    }

    /**
     * GET /api/v1/products/{product}/image
     */
    public function streamImage(Product $product): Response
    {
        $this->authorize('view', $product);

        if (! $product->image || ! Storage::disk('local')->exists($product->image)) {
            abort(404, 'Product image not found');
        }

        return Storage::disk('local')->response($product->image);
    }
}
