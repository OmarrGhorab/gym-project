<?php

namespace App\Actions\Products;

use App\Models\Product;
use Illuminate\Http\UploadedFile;

final class StoreProduct
{
    /**
     * Create and persist a new product from validated data.
     *
     * @param  array<string, mixed>  $data
     */
    public function handle(array $data): Product
    {
        if (isset($data['image']) && $data['image'] instanceof UploadedFile) {
            $path = $data['image']->store('products', 'local');
            $data['image'] = $path;
        }

        return Product::create($data);
    }
}
