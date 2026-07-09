<?php

namespace App\Actions\Products;

use App\Models\Product;
use App\Services\OperationalNotifier;
use App\Services\ImageUploadService;
use Illuminate\Http\UploadedFile;

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
            $service = app(ImageUploadService::class);
            $path = $service->store($data['image'], 'products', $product->image);
            $data['image'] = $path;
        }

        $product->update($data);

        $freshProduct = $product->fresh();
        app(OperationalNotifier::class)->lowStock($freshProduct);

        return $freshProduct;
    }
}
