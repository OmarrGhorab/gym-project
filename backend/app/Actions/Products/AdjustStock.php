<?php

namespace App\Actions\Products;

use App\Models\InventoryMovement;
use App\Models\Product;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class AdjustStock
{
    /**
     * Adjust stock quantity of a product and log the movement.
     *
     * @param  array{type: string, quantity: int, reason: string, created_by: int}  $data
     *
     * @throws ValidationException
     */
    public function handle(Product $product, array $data): Product
    {
        return DB::transaction(function () use ($product, $data) {
            /** @var Product $lockedProduct */
            $lockedProduct = Product::where('id', $product->id)
                ->lockForUpdate()
                ->firstOrFail();

            $type = $data['type'];
            $quantity = $data['quantity'];

            if ($type === 'out') {
                if ($lockedProduct->stock_quantity < $quantity) {
                    throw ValidationException::withMessages([
                        'quantity' => ['The quantity to deduct exceeds current stock level.'],
                    ]);
                }
                $newStock = $lockedProduct->stock_quantity - $quantity;
                $movementQty = -$quantity;
            } else {
                $newStock = $lockedProduct->stock_quantity + $quantity;
                $movementQty = $quantity;
            }

            $lockedProduct->update([
                'stock_quantity' => $newStock,
            ]);

            InventoryMovement::create([
                'product_id' => $lockedProduct->id,
                'type' => $type,
                'quantity' => $movementQty,
                'reason' => $data['reason'],
                'created_by' => $data['created_by'] ?? null,
            ]);

            return $lockedProduct->fresh();
        });
    }
}
