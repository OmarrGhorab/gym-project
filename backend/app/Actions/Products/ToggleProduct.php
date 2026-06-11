<?php

namespace App\Actions\Products;

use App\Models\Product;

final class ToggleProduct
{
    /**
     * Flip the is_active flag on the given product.
     */
    public function handle(Product $product): Product
    {
        $product->update(['is_active' => ! $product->is_active]);

        return $product->fresh();
    }
}
