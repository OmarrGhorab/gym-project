<?php

namespace Database\Seeders;

use App\Models\Member;
use App\Models\Payment;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Seeds high-volume POS sales activity spanning 12 months.
 *
 * Creates ~5,000 sales with items, payments, and day-level granularity
 * designed to populate the POS dashboard sales chart, hourly activity
 * heat-map, top products (with units sold), payment method distribution,
 * and recent orders feed.
 *
 * Revenue, sales count, and units sold are all included per transaction.
 */
class SalesActivitySeeder extends Seeder
{
    /**
     * Total sales per month (growing curve to simulate business growth).
     */
    private const SALES_PER_MONTH = [120, 145, 170, 200, 230, 260, 290, 320, 350, 380, 410, 450];

    private const MONTHS = 12;

    /**
     * Hourly distribution weights (sum to 100).
     * Peaks at 8-10 AM, 12-2 PM, and 5-8 PM.
     */
    private const HOURLY_WEIGHTS = [
        0, 0, 0, 0, 0, 1, 3, 8, 11, 9, 5, 7,
        9, 8, 4, 3, 4, 10, 12, 9, 6, 3, 1, 0,
    ];

    public function run(): void
    {
        DB::transaction(function (): void {
            $admin = User::where('email', 'admin@gym.test')->firstOrFail();
            $cashier = User::where('email', 'cashier@gym.test')->firstOrFail();
            $manager = User::where('email', 'manager@gym.test')->firstOrFail();
            $users = collect([$admin, $cashier, $manager]);

            $this->clearPreviousSalesActivityData();

            $products = $this->ensureSalesActivityProducts();
            $members = $this->seedSalesActivityMembers($admin);

            $this->seedSalesActivityData($members, $users, $products, $admin);

            Cache::forget('dashboard:summary:v2');
        });
    }

    private function clearPreviousSalesActivityData(): void
    {
        $saMembers = Member::query()->where('email', 'like', 'sa.member.%@gym.test')->pluck('id');
        if ($saMembers->isEmpty()) {
            return;
        }

        $saSales = Sale::query()->whereIn('member_id', $saMembers)->pluck('id');
        if ($saSales->isNotEmpty()) {
            Payment::query()
                ->where('payable_type', Sale::class)
                ->whereIn('payable_id', $saSales)
                ->delete();
            SaleItem::query()->whereIn('sale_id', $saSales)->delete();
            Sale::query()->whereIn('id', $saSales)->delete();
        }
    }

    /**
     * @return Collection<int, Product>
     */
    private function ensureSalesActivityProducts(): Collection
    {
        $catalog = [
            ['SA: Protein Shake Vanilla', 'drinks', 90, 48, 85],
            ['SA: Protein Shake Chocolate', 'drinks', 90, 48, 78],
            ['SA: Cold Brew Iced Coffee', 'drinks', 65, 28, 55],
            ['SA: Electrolyte Water 500ml', 'drinks', 40, 15, 130],
            ['SA: Zero Sugar Energy', 'drinks', 38, 14, 100],
            ['SA: Whey Protein 2.5KG', 'supplements', 2100, 1480, 18],
            ['SA: Creatine 1KG', 'supplements', 950, 580, 14],
            ['SA: Pre-Workout 450g', 'supplements', 780, 480, 16],
            ['SA: BCAA Powder 500g', 'supplements', 520, 310, 11],
            ['SA: Multivitamin Pack', 'supplements', 380, 210, 25],
            ['SA: Gym Gloves Leather', 'accessories', 280, 130, 42],
            ['SA: Lifting Straps Pro', 'accessories', 210, 90, 36],
            ['SA: Shaker Bottle 700ml', 'accessories', 150, 60, 60],
            ['SA: Gym Towel Premium', 'accessories', 120, 50, 95],
            ['SA: Yoga Mat 6mm', 'accessories', 450, 220, 20],
            ['SA: Skipping Rope Speed', 'accessories', 170, 70, 48],
            ['SA: Foam Roller 45cm', 'accessories', 360, 170, 16],
            ['SA: Sports Cap Breathable', 'apparel', 230, 100, 28],
            ['SA: Training Tank Top', 'apparel', 340, 160, 22],
            ['SA: Compression Leggings', 'apparel', 490, 240, 17],
            ['SA: Protein Bar Box', 'snacks', 280, 150, 65],
            ['SA: Energy Gel Pack', 'snacks', 45, 20, 110],
            ['SA: Greek Yogurt Cup', 'snacks', 60, 30, 55],
            ['SA: Meal Prep Container', 'snacks', 130, 65, 40],
            ['SA: Healthy Trail Mix', 'snacks', 95, 48, 35],
        ];

        return collect($catalog)->map(function (array $item, int $index): Product {
            [$name, $category, $price, $cost, $stock] = $item;

            return Product::query()->updateOrCreate(
                ['sku' => 'SA-'.str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT)],
                [
                    'name' => $name,
                    'category' => $category,
                    'price' => $price,
                    'cost' => $cost,
                    'stock_quantity' => $stock,
                    'low_stock_threshold' => 10,
                    'image' => null,
                    'is_active' => true,
                ],
            );
        });
    }

    /**
     * @return Collection<int, Member>
     */
    private function seedSalesActivityMembers(User $admin): Collection
    {
        $members = collect();
        $totalMembers = 200;

        for ($i = 1; $i <= $totalMembers; $i++) {
            $joinDate = now()->subDays(rand(60, 400));

            $members->push(Member::query()->updateOrCreate(
                ['email' => "sa.member.{$i}@gym.test"],
                [
                    'name' => 'SA Customer '.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                    'phone' => '+2017'.str_pad((string) (400000000 + $i), 9, '0', STR_PAD_LEFT),
                    'gender' => ['male', 'female', null][$i % 3],
                    'photo_path' => null,
                    'national_id' => str_pad((string) (59900000000000 + $i), 14, '0', STR_PAD_LEFT),
                    'birth_date' => now()->subYears(rand(18, 55))->subDays(rand(1, 330))->toDateString(),
                    'join_date' => $joinDate->toDateString(),
                    'status' => 'active',
                    'notes' => null,
                    'created_by' => $admin->id,
                ],
            ));
        }

        return $members;
    }

    /**
     * @param  Collection<int, Member>  $members
     * @param  Collection<int, User>  $users
     * @param  Collection<int, Product>  $products
     */
    private function seedSalesActivityData(Collection $members, Collection $users, Collection $products, User $admin): void
    {
        $saleIndex = 0;
        $now = CarbonImmutable::now();

        for ($monthOffset = self::MONTHS - 1; $monthOffset >= 0; $monthOffset--) {
            $monthIdx = self::MONTHS - 1 - $monthOffset;
            $monthStart = $now->subMonthsNoOverflow($monthOffset)->startOfMonth();
            $daysInMonth = (int) $monthStart->daysInMonth;
            $salesThisMonth = self::SALES_PER_MONTH[$monthIdx];

            $remaining = $salesThisMonth;

            for ($day = 0; $day < $daysInMonth; $day++) {
                $date = $monthStart->copy()->addDays($day);

                if ($remaining <= 0) {
                    break;
                }

                $isWeekend = in_array($date->dayOfWeek, [5, 6], true);
                $basePerDay = max(1, (int) ceil($remaining / max(1, $daysInMonth - $day)));
                $daySales = $isWeekend
                    ? $basePerDay + rand(2, 6)
                    : $basePerDay + rand(-2, 3);
                $daySales = max(1, min($daySales, $remaining));

                for ($s = 0; $s < $daySales; $s++) {
                    $hour = $this->pickWeightedHour();
                    $minute = rand(0, 59);
                    $second = rand(0, 59);
                    $soldAt = $date->copy()->setTime($hour, $minute, $second);

                    $itemCount = $this->pickItemCount();
                    $selectedProducts = $products->random(min($itemCount, $products->count()));
                    if ($selectedProducts instanceof Product) {
                        $selectedProducts = collect([$selectedProducts]);
                    }

                    $subtotal = 0;
                    $totalUnits = 0;

                    $sale = Sale::create([
                        'idempotency_key' => (string) Str::uuid(),
                        'member_id' => $members->random()->id,
                        'sold_by_user_id' => $users->random()->id,
                        'subtotal' => 0,
                        'discount' => 0,
                        'total' => 0,
                        'payment_method' => $this->pickPaymentMethod($hour),
                        'status' => 'completed',
                        'notes' => null,
                    ]);

                    foreach ($selectedProducts as $product) {
                        $quantity = $this->pickQuantity();
                        $lineTotal = round((float) $product->price * $quantity, 2);
                        $subtotal += $lineTotal;
                        $totalUnits += $quantity;

                        SaleItem::create([
                            'sale_id' => $sale->id,
                            'product_id' => $product->id,
                            'quantity' => $quantity,
                            'unit_price' => $product->price,
                            'total' => $lineTotal,
                        ]);
                    }

                    $discount = ($saleIndex % 16 === 0) ? round($subtotal * rand(5, 15) / 100, 2) : 0;
                    $total = max(0, round($subtotal - $discount, 2));

                    DB::table('sales')->where('id', $sale->id)->update([
                        'subtotal' => $subtotal,
                        'discount' => $discount,
                        'total' => $total,
                        'created_at' => $soldAt->toDateTimeString(),
                        'updated_at' => $soldAt->toDateTimeString(),
                    ]);

                    Payment::create([
                        'payable_type' => Sale::class,
                        'payable_id' => $sale->id,
                        'amount' => $total,
                        'method' => $sale->payment_method,
                        'status' => 'paid',
                        'paid_at' => $soldAt,
                        'due_date' => null,
                        'created_by' => $admin->id,
                    ]);

                    $saleIndex++;
                    $remaining--;
                }
            }
        }
    }

    /**
     * Pick an hour weighted by realistic gym POS patterns.
     */
    private function pickWeightedHour(): int
    {
        $totalWeight = array_sum(self::HOURLY_WEIGHTS);
        $roll = rand(1, $totalWeight);
        $cumulative = 0;

        foreach (self::HOURLY_WEIGHTS as $hour => $weight) {
            $cumulative += $weight;
            if ($roll <= $cumulative) {
                return $hour;
            }
        }

        return 12;
    }

    /**
     * Weighted item count distribution.
     */
    private function pickItemCount(): int
    {
        $roll = rand(1, 100);

        return match (true) {
            $roll <= 40 => 1,
            $roll <= 72 => 2,
            $roll <= 90 => 3,
            $roll <= 97 => 4,
            default => 5,
        };
    }

    /**
     * Weighted quantity per line item.
     */
    private function pickQuantity(): int
    {
        $roll = rand(1, 100);

        return match (true) {
            $roll <= 50 => 1,
            $roll <= 80 => 2,
            $roll <= 93 => 3,
            default => rand(4, 6),
        };
    }

    /**
     * Payment method preferences by time of day.
     * Morning/evening peaks favor card; afternoon favors cash.
     */
    private function pickPaymentMethod(int $hour): string
    {
        $roll = rand(1, 100);

        if ($hour >= 8 && $hour <= 10) {
            return match (true) {
                $roll <= 35 => 'cash',
                $roll <= 80 => 'card',
                default => 'bank_transfer',
            };
        }

        if ($hour >= 17 && $hour <= 20) {
            return match (true) {
                $roll <= 40 => 'cash',
                $roll <= 82 => 'card',
                default => 'bank_transfer',
            };
        }

        return match (true) {
            $roll <= 50 => 'cash',
            $roll <= 82 => 'card',
            default => 'bank_transfer',
        };
    }
}
