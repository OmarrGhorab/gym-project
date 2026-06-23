<?php

namespace App\Actions\Sales;

use App\Models\Product;
use App\Models\Sale;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VoidSaleAction
{
    /**
     * Execute the void sale action.
     *
     * @param  array<string, mixed>  $data
     *
     * @throws ValidationException
     */
    public function execute(Sale $sale, array $data, User $user): Sale
    {
        return DB::transaction(function () use ($sale, $user) {
            // Lock the sale row with eager-loaded items
            $sale = Sale::where('id', $sale->id)->with(['items', 'payment'])->lockForUpdate()->firstOrFail();

            if ($sale->status === 'voided') {
                throw ValidationException::withMessages([
                    'sale' => ['This sale has already been voided.'],
                ]);
            }

            // Loop through items and restore stock + write inventory movements
            foreach ($sale->items as $item) {
                $this->processItem($item, $sale, $user);
            }

            // Reverse payment status
            if ($sale->payment) {
                $sale->payment->status = 'voided';
                $sale->payment->save();
            }

            // Mark sale as voided
            $sale->status = 'voided';
            $sale->save();

            $sale->load(['items.product', 'payment', 'member', 'soldBy']);

            return $sale;
        });
    }

    /**
     * Process stock restoration and inventory movement for a sale item.
     */
    protected function processItem(mixed $item, Sale $sale, User $user): void
    {
        $product = Product::where('id', $item->product_id)->lockForUpdate()->firstOrFail();
        $product->stock_quantity += $item->quantity;
        $product->save();

        $product->inventoryMovements()->create([
            'type' => 'in',
            'quantity' => $item->quantity,
            'reason' => "Void Sale #{$sale->id}",
            'created_by' => $user->id,
        ]);
    }
}
