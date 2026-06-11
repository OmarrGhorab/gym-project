<?php

namespace App\Actions\Products;

use App\Models\Product;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

final class UpdateProduct
{
    /**
     * Update an existing product from validated data.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(Product $product, array $data): Product
    {
        if (isset($data['image']) && $data['image'] instanceof UploadedFile) {
            // Delete old image if present
            if ($product->image) {
                Storage::disk('local')->delete($product->image);
            }
            $path = $data['image']->store('products', 'local');
            $data['image'] = $path;
        }

        $product->update($data);

        return $product->fresh();
    }
}
