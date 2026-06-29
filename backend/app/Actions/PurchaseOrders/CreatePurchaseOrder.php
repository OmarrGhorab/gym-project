<?php

namespace App\Actions\PurchaseOrders;

use App\Models\PurchaseOrder;
use Illuminate\Support\Facades\DB;

final class CreatePurchaseOrder
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data): PurchaseOrder
    {
        return DB::transaction(function () use ($data): PurchaseOrder {
            $items = collect($data['items']);
            $subtotal = $items->sum(fn (array $item): float => (float) $item['unit_cost'] * (int) $item['quantity_ordered']);

            $purchaseOrder = PurchaseOrder::query()->create([
                'reference' => $this->nextReference(),
                'supplier_name' => $data['supplier_name'],
                'supplier_phone' => $data['supplier_phone'] ?? null,
                'ordered_at' => $data['ordered_at'] ?? now()->toDateString(),
                'expected_at' => $data['expected_at'] ?? null,
                'status' => $data['status'] ?? 'ordered',
                'subtotal' => number_format($subtotal, 2, '.', ''),
                'notes' => $data['notes'] ?? null,
                'created_by' => $data['created_by'] ?? null,
            ]);

            foreach ($items as $item) {
                $purchaseOrder->items()->create([
                    'product_id' => $item['product_id'],
                    'quantity_ordered' => $item['quantity_ordered'],
                    'quantity_received' => 0,
                    'unit_cost' => number_format((float) $item['unit_cost'], 2, '.', ''),
                    'line_total' => number_format((float) $item['unit_cost'] * (int) $item['quantity_ordered'], 2, '.', ''),
                ]);
            }

            return $purchaseOrder->fresh(['items.product']);
        });
    }

    private function nextReference(): string
    {
        $nextId = ((int) (PurchaseOrder::query()->max('id') ?? 0)) + 1;

        return 'PO-'.str_pad((string) $nextId, 5, '0', STR_PAD_LEFT);
    }
}
