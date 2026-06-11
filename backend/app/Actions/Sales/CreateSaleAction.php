<?php

namespace App\Actions\Sales;

use App\Broadcasting\Events\NewSaleEvent;
use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateSaleAction
{
    /**
     * Execute the sale creation action.
     *
     * @param  array<string, mixed>  $data
     *
     * @throws ValidationException
     */
    public function execute(array $data, User $cashier): Sale
    {
        return DB::transaction(function () use ($data, $cashier) {
            // 1. Idempotency Check
            $existing = Sale::where('idempotency_key', $data['idempotency_key'])
                ->with(['items.product', 'payment', 'member', 'soldBy'])
                ->first();

            if ($existing) {
                return $existing;
            }

            $itemData = collect($data['items']);
            $productIds = $itemData->pluck('product_id')->all();

            // 2. Lock products for update to handle concurrency safely
            $products = Product::whereIn('id', $productIds)
                ->lockForUpdate()
                ->get()
                ->keyBy('id');

            // 3. Validation: Active product and stock check
            foreach ($itemData as $index => $item) {
                $product = $products->get($item['product_id']);

                if (! $product || ! $product->is_active) {
                    throw ValidationException::withMessages([
                        "items.{$index}.product_id" => ['The selected product is inactive or invalid.'],
                    ]);
                }

                if ($product->stock_quantity < $item['quantity']) {
                    throw ValidationException::withMessages([
                        "items.{$index}.quantity" => ["The product {$product->name} has insufficient stock."],
                    ]);
                }
            }

            // 4. Calculate totals
            $subtotal = '0.00';
            $lineItemsData = [];

            foreach ($itemData as $item) {
                $product = $products->get($item['product_id']);
                $unitPrice = number_format((float) $product->price, 2, '.', '');
                $quantity = (string) $item['quantity'];

                $itemTotal = bcmul($quantity, $unitPrice, 2);
                $subtotal = bcadd($subtotal, $itemTotal, 2);

                $lineItemsData[] = [
                    'product' => $product,
                    'quantity' => $item['quantity'],
                    'unit_price' => $unitPrice,
                    'total' => $itemTotal,
                ];
            }

            $discount = isset($data['discount']) ? number_format((float) $data['discount'], 2, '.', '') : '0.00';

            if (bccomp($discount, '0.00', 2) > 0) {
                if (bccomp($discount, $subtotal, 2) >= 0) {
                    throw ValidationException::withMessages([
                        'discount' => ['The discount cannot be greater than or equal to the subtotal.'],
                    ]);
                }
            }

            $total = bcsub($subtotal, $discount, 2);

            // 5. Update stock and write inventory movements
            foreach ($lineItemsData as $lineItem) {
                $product = $lineItem['product'];
                $qty = $lineItem['quantity'];

                $product->stock_quantity -= $qty;
                $product->save();

                $product->inventoryMovements()->create([
                    'type' => 'out',
                    'quantity' => -$qty,
                    'reason' => 'Sale',
                    'created_by' => $cashier->id,
                ]);
            }

            // 6. Create Sale
            $sale = Sale::create([
                'idempotency_key' => $data['idempotency_key'],
                'member_id' => $data['member_id'] ?? null,
                'sold_by_user_id' => $cashier->id,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'total' => $total,
                'payment_method' => $data['payment_method'],
                'status' => 'completed',
                'notes' => $data['notes'] ?? null,
            ]);

            // 7. Create Sale Items
            foreach ($lineItemsData as $lineItem) {
                $sale->items()->create([
                    'product_id' => $lineItem['product']->id,
                    'quantity' => $lineItem['quantity'],
                    'unit_price' => $lineItem['unit_price'],
                    'total' => $lineItem['total'],
                ]);
            }

            // 8. Create Payment
            $sale->payment()->create([
                'amount' => $total,
                'method' => $data['payment_method'],
                'status' => 'paid',
                'paid_at' => now(),
                'created_by' => $cashier->id,
            ]);

            // 9. Dispatch Real-time Event Post-Commit
            DB::afterCommit(function () use ($sale, $cashier): void {
                event(new NewSaleEvent(
                    saleId: $sale->id,
                    total: $sale->total,
                    cashierName: $cashier->name,
                    timestamp: $sale->created_at->toIso8601String()
                ));
            });

            // Load relations for response
            $sale->load(['items.product', 'payment', 'member', 'soldBy']);

            return $sale;
        });
    }
}
