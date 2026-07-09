<?php

namespace App\Actions\Products;

use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\User;
use App\Services\OperationalNotifier;
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

            $freshProduct = $lockedProduct->fresh();
            $activity = activity('inventory')
                ->performedOn($freshProduct);

            if (! empty($data['created_by'])) {
                $causer = User::query()->find($data['created_by']);

                if ($causer) {
                    $activity->causedBy($causer);
                }
            }

            $activity
                ->event('stock_adjusted')
                ->withProperties([
                    'product_id' => $freshProduct->id,
                    'product_name' => $freshProduct->name,
                    'movement_type' => $type,
                    'quantity' => $movementQty,
                    'new_stock' => $freshProduct->stock_quantity,
                    'reason' => $data['reason'],
                    'created_by' => $data['created_by'] ?? null,
                ])
                ->log($freshProduct->name.' stock adjusted by '.$movementQty.'. New stock: '.$freshProduct->stock_quantity);

            DB::afterCommit(function () use ($freshProduct): void {
                app(OperationalNotifier::class)->lowStock($freshProduct);
            });

            return $freshProduct;
        });
    }
}
