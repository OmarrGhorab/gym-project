<?php

namespace Database\Seeders;

use App\Models\Product;
use Illuminate\Database\Seeder;

/**
 * Seed the gym's default retail catalog.
 *
 * Covers supplements, drinks, snacks, accessories, and apparel commonly sold
 * at the front desk. SKUs are deterministic so the seeder is idempotent.
 */
class ProductSeeder extends Seeder
{
    public function run(): void
    {
        $products = [
            // Supplements
            ['name' => 'Whey Protein 2kg', 'category' => 'supplements', 'sku' => 'GYM-WHEY-2KG', 'price' => 1850.00, 'cost' => 1320.00, 'stock_quantity' => 22, 'low_stock_threshold' => 5],
            ['name' => 'Whey Protein 1kg', 'category' => 'supplements', 'sku' => 'GYM-WHEY-1KG', 'price' => 980.00, 'cost' => 700.00, 'stock_quantity' => 30, 'low_stock_threshold' => 5],
            ['name' => 'Creatine Monohydrate 300g', 'category' => 'supplements', 'sku' => 'GYM-CREA-300G', 'price' => 780.00, 'cost' => 470.00, 'stock_quantity' => 18, 'low_stock_threshold' => 5],
            ['name' => 'Pre-Workout Citrus', 'category' => 'supplements', 'sku' => 'GYM-PRE-CIT', 'price' => 920.00, 'cost' => 620.00, 'stock_quantity' => 12, 'low_stock_threshold' => 5],
            ['name' => 'BCAA Berry Blast', 'category' => 'supplements', 'sku' => 'GYM-BCAA-BRY', 'price' => 650.00, 'cost' => 410.00, 'stock_quantity' => 8, 'low_stock_threshold' => 5],
            ['name' => 'Mass Gainer 3kg', 'category' => 'supplements', 'sku' => 'GYM-MASS-3KG', 'price' => 2100.00, 'cost' => 1550.00, 'stock_quantity' => 7, 'low_stock_threshold' => 5],
            ['name' => 'Magnesium 90 Tablets', 'category' => 'supplements', 'sku' => 'GYM-MAG-90T', 'price' => 430.00, 'cost' => 230.00, 'stock_quantity' => 10, 'low_stock_threshold' => 5],
            ['name' => 'Multivitamin 60 Tablets', 'category' => 'supplements', 'sku' => 'GYM-MULTI-60', 'price' => 520.00, 'cost' => 290.00, 'stock_quantity' => 15, 'low_stock_threshold' => 5],

            // Drinks
            ['name' => 'Protein Shake Vanilla', 'category' => 'drinks', 'sku' => 'GYM-SHAKE-VAN', 'price' => 95.00, 'cost' => 52.00, 'stock_quantity' => 80, 'low_stock_threshold' => 10],
            ['name' => 'Protein Shake Chocolate', 'category' => 'drinks', 'sku' => 'GYM-SHAKE-CHOC', 'price' => 95.00, 'cost' => 52.00, 'stock_quantity' => 75, 'low_stock_threshold' => 10],
            ['name' => 'Electrolyte Water', 'category' => 'drinks', 'sku' => 'GYM-ELCY-WTR', 'price' => 45.00, 'cost' => 18.00, 'stock_quantity' => 120, 'low_stock_threshold' => 15],
            ['name' => 'Cold Brew Coffee', 'category' => 'drinks', 'sku' => 'GYM-COLD-BREW', 'price' => 70.00, 'cost' => 30.00, 'stock_quantity' => 55, 'low_stock_threshold' => 10],
            ['name' => 'Zero Sugar Soda', 'category' => 'drinks', 'sku' => 'GYM-ZERO-SODA', 'price' => 38.00, 'cost' => 14.00, 'stock_quantity' => 105, 'low_stock_threshold' => 10],
            ['name' => 'Mineral Water 500ml', 'category' => 'drinks', 'sku' => 'GYM-WTR-500', 'price' => 20.00, 'cost' => 7.00, 'stock_quantity' => 200, 'low_stock_threshold' => 20],

            // Snacks
            ['name' => 'Protein Bar Peanut', 'category' => 'snacks', 'sku' => 'GYM-BAR-PNT', 'price' => 55.00, 'cost' => 25.00, 'stock_quantity' => 140, 'low_stock_threshold' => 15],
            ['name' => 'Protein Bar Brownie', 'category' => 'snacks', 'sku' => 'GYM-BAR-BRW', 'price' => 55.00, 'cost' => 25.00, 'stock_quantity' => 130, 'low_stock_threshold' => 15],
            ['name' => 'Energy Gel', 'category' => 'snacks', 'sku' => 'GYM-GEL-ENR', 'price' => 40.00, 'cost' => 18.00, 'stock_quantity' => 95, 'low_stock_threshold' => 10],
            ['name' => 'Greek Yogurt Cup', 'category' => 'snacks', 'sku' => 'GYM-YOG-GRK', 'price' => 65.00, 'cost' => 34.00, 'stock_quantity' => 60, 'low_stock_threshold' => 10],
            ['name' => 'Meal Prep Chicken', 'category' => 'snacks', 'sku' => 'GYM-MEAL-CHKN', 'price' => 150.00, 'cost' => 95.00, 'stock_quantity' => 32, 'low_stock_threshold' => 5],

            // Accessories
            ['name' => 'Gym Gloves Black', 'category' => 'accessories', 'sku' => 'GYM-GLV-BLK', 'price' => 240.00, 'cost' => 115.00, 'stock_quantity' => 45, 'low_stock_threshold' => 5],
            ['name' => 'Lifting Straps', 'category' => 'accessories', 'sku' => 'GYM-STRAP-LFT', 'price' => 190.00, 'cost' => 80.00, 'stock_quantity' => 38, 'low_stock_threshold' => 5],
            ['name' => 'Resistance Band Set', 'category' => 'accessories', 'sku' => 'GYM-BAND-SET', 'price' => 360.00, 'cost' => 170.00, 'stock_quantity' => 30, 'low_stock_threshold' => 5],
            ['name' => 'Shaker Bottle', 'category' => 'accessories', 'sku' => 'GYM-SHAKER-700', 'price' => 160.00, 'cost' => 65.00, 'stock_quantity' => 65, 'low_stock_threshold' => 10],
            ['name' => 'Gym Towel', 'category' => 'accessories', 'sku' => 'GYM-TOWEL', 'price' => 130.00, 'cost' => 55.00, 'stock_quantity' => 90, 'low_stock_threshold' => 10],
            ['name' => 'Yoga Mat', 'category' => 'accessories', 'sku' => 'GYM-MAT-YOGA', 'price' => 520.00, 'cost' => 270.00, 'stock_quantity' => 16, 'low_stock_threshold' => 5],
            ['name' => 'Knee Sleeves', 'category' => 'accessories', 'sku' => 'GYM-KNEE-SLV', 'price' => 690.00, 'cost' => 360.00, 'stock_quantity' => 11, 'low_stock_threshold' => 5],
            ['name' => 'Foam Roller', 'category' => 'accessories', 'sku' => 'GYM-FOAM-RL', 'price' => 390.00, 'cost' => 190.00, 'stock_quantity' => 14, 'low_stock_threshold' => 5],
            ['name' => 'Skipping Rope', 'category' => 'accessories', 'sku' => 'GYM-ROPE-SKP', 'price' => 180.00, 'cost' => 75.00, 'stock_quantity' => 52, 'low_stock_threshold' => 5],
            ['name' => 'Wrist Wraps', 'category' => 'accessories', 'sku' => 'GYM-WRST-WRP', 'price' => 220.00, 'cost' => 90.00, 'stock_quantity' => 33, 'low_stock_threshold' => 5],
            ['name' => 'Locker Padlock', 'category' => 'accessories', 'sku' => 'GYM-LOCK', 'price' => 110.00, 'cost' => 45.00, 'stock_quantity' => 24, 'low_stock_threshold' => 5],

            // Apparel
            ['name' => 'Training T-Shirt', 'category' => 'apparel', 'sku' => 'GYM-TEE-TRN', 'price' => 420.00, 'cost' => 210.00, 'stock_quantity' => 28, 'low_stock_threshold' => 5],
            ['name' => 'Compression Shorts', 'category' => 'apparel', 'sku' => 'GYM-SHORT-CMP', 'price' => 480.00, 'cost' => 240.00, 'stock_quantity' => 20, 'low_stock_threshold' => 5],
            ['name' => 'Sports Cap', 'category' => 'apparel', 'sku' => 'GYM-CAP-SPT', 'price' => 260.00, 'cost' => 120.00, 'stock_quantity' => 26, 'low_stock_threshold' => 5],
        ];

        foreach ($products as $product) {
            Product::query()->updateOrCreate(
                ['sku' => $product['sku']],
                $product + ['image' => null, 'is_active' => true],
            );
        }
    }
}
