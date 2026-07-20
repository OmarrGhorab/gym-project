<?php

namespace App\Actions\Sales;

use App\Actions\ShiftSessions\ResolveOpenShiftSession;
use App\Broadcasting\Events\NewSaleEvent;
use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use App\Services\OperationalNotifier;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreateSaleAction
{
    public function __construct(
        private readonly ResolveOpenShiftSession $openShiftSession,
    ) {}

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
            $lowStockProducts = collect();
            foreach ($lineItemsData as $lineItem) {
                $product = $lineItem['product'];
                $qty = $lineItem['quantity'];

                $product->stock_quantity -= $qty;
                $product->save();

                if ($product->stock_quantity <= $product->low_stock_threshold) {
                    $lowStockProducts->push($product->fresh());
                }

                $product->inventoryMovements()->create([
                    'type' => 'out',
                    'quantity' => -$qty,
                    'reason' => 'Sale',
                    'created_by' => $cashier->id,
                ]);
            }

            $shiftSessionId = $data['shift_session_id'] ?? $this->openShiftSession->current()?->id;

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
                'shift_session_id' => $shiftSessionId,
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
                'shift_session_id' => $shiftSessionId,
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

            DB::afterCommit(function () use ($lowStockProducts): void {
                $notifier = app(OperationalNotifier::class);
                $lowStockProducts->filter()->each(fn (Product $product) => $notifier->lowStock($product));
            });

            // Load relations for response
            $sale->load(['items.product', 'payment', 'member', 'soldBy']);
            $itemsLabel = $sale->items
                ->map(fn ($item): string => ($item->product?->name ?? 'Product').' x'.$item->quantity)
                ->join(', ');
            activity('sales')
                ->causedBy($cashier)
                ->performedOn($sale)
                ->event('completed')
                ->withProperties([
                    'sale_id' => $sale->id,
                    'member_id' => $sale->member_id,
                    'member_name' => $sale->member?->name ?? 'Walk-in',
                    'items' => $itemsLabel,
                    'payment_method' => $sale->payment_method,
                    'total' => (string) $sale->total,
                ])
                ->log($cashier->name.' sold '.$itemsLabel.' to '.($sale->member?->name ?? 'walk-in').' for EGP '.$sale->total);

            return $sale;
        });
    }
}
