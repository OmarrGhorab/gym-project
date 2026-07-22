<?php

namespace App\Actions\PurchaseOrders;

use App\Models\GymTask;
use App\Models\InventoryMovement;
use App\Models\Product;
use App\Models\PurchaseOrder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class ReceivePurchaseOrder
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function handle(PurchaseOrder $purchaseOrder, array $data): PurchaseOrder
    {
        if (in_array($purchaseOrder->status, ['received', 'cancelled'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Only open purchase orders can be received.'],
            ]);
        }

        return DB::transaction(function () use ($purchaseOrder, $data): PurchaseOrder {
            $purchaseOrder->load('items');
            $receivedById = $data['received_by'] ?? null;
            $requestedItems = collect($data['items'] ?? [])
                ->keyBy(fn (array $item): int => (int) $item['id']);

            foreach ($purchaseOrder->items as $item) {
                $targetReceived = $requestedItems->has($item->id)
                    ? (int) $requestedItems->get($item->id)['quantity_received']
                    : (int) $item->quantity_ordered;
                $targetReceived = min($targetReceived, (int) $item->quantity_ordered);
                $delta = $targetReceived - (int) $item->quantity_received;

                if ($delta <= 0) {
                    continue;
                }

                $product = Product::query()->lockForUpdate()->findOrFail($item->product_id);
                $product->increment('stock_quantity', $delta);

                InventoryMovement::query()->create([
                    'product_id' => $product->id,
                    'type' => 'in',
                    'quantity' => $delta,
                    'reason' => 'Purchase order '.$purchaseOrder->reference.' received',
                    'created_by' => $receivedById,
                ]);

                $item->update(['quantity_received' => $targetReceived]);
            }

            $purchaseOrder->load('items');
            $allReceived = $purchaseOrder->items->every(
                fn ($item): bool => (int) $item->quantity_received >= (int) $item->quantity_ordered
            );
            $anyReceived = $purchaseOrder->items->contains(
                fn ($item): bool => (int) $item->quantity_received > 0
            );

            $receivedAt = now();

            $purchaseOrder->update([
                'status' => $allReceived ? 'received' : ($anyReceived ? 'partial' : $purchaseOrder->status),
                'received_at' => $allReceived ? $receivedAt : $purchaseOrder->received_at,
                'received_by' => $allReceived ? $receivedById : $purchaseOrder->received_by,
                'notes' => $data['notes'] ?? $purchaseOrder->notes,
            ]);

            if ($allReceived && $purchaseOrder->expected_at && $receivedAt->lt($purchaseOrder->expected_at->startOfDay())) {
                GymTask::query()->create([
                    'title' => 'Purchase Order '.$purchaseOrder->reference.' received early',
                    'description' => 'Purchase order '.$purchaseOrder->reference.' from '.$purchaseOrder->supplier_name.' was received on '.$receivedAt->toDateString().' but was expected on '.$purchaseOrder->expected_at->toDateString().'.',
                    'status' => 'planned',
                    'priority' => 'medium',
                    'category' => 'inventory',
                    'created_by' => $receivedById,
                ]);
            }

            return $purchaseOrder->fresh(['items.product']);
        });
    }
}
