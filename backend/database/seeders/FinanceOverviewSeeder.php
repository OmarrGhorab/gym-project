<?php

namespace Database\Seeders;

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Payroll;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Subscription;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Seeds dense multi-month finance data for the finance overview dashboard,
 * financial reports, revenue charts, and expense tracking.
 *
 * Creates 12 months of revenue (subscriptions + POS sales), expenses,
 * payroll, commissions, and outstanding dues with realistic growth patterns.
 */
class FinanceOverviewSeeder extends Seeder
{
    private const MONTHS = 12;

    /**
     * Month index → multiplier for revenue volume (simulates business growth).
     */
    private const GROWTH_CURVE = [0.30, 0.35, 0.42, 0.50, 0.58, 0.65, 0.72, 0.78, 0.85, 0.92, 0.96, 1.00];

    /**
     * Month index → sales count per month.
     */
    private const SALES_PER_MONTH = [135, 158, 189, 225, 261, 293, 324, 351, 383, 414, 432, 450];

    /**
     * Month index → subscription count per month.
     */
    private const SUBSCRIPTIONS_PER_MONTH = [45, 53, 63, 75, 87, 98, 108, 117, 128, 138, 144, 150];

    /**
     * Month index → expense count per month (each category once + extras).
     */
    private const EXPENSES_PER_MONTH = [9, 9, 11, 11, 12, 12, 12, 14, 14, 14, 14, 14];

    public function run(): void
    {
        DB::transaction(function (): void {
            $admin = User::where('email', 'admin@gym.test')->firstOrFail();
            $cashier = User::where('email', 'cashier@gym.test')->firstOrFail();
            $manager = User::where('email', 'manager@gym.test')->firstOrFail();
            $users = collect([$admin, $cashier, $manager]);

            $this->clearPreviousFinanceData();

            $plans = $this->ensurePlans();
            $products = $this->ensureProducts();
            $employees = Employee::where('status', 'active')->get();
            $members = $this->seedFinanceMembers($admin);

            $subscriptions = $this->seedFinanceSubscriptions($members, $plans, $users, $admin);
            $sales = $this->seedFinanceSales($members, $users, $products, $admin);
            $this->seedFinanceExpenses($admin);
            $this->seedFinancePayroll($employees);
            $this->seedFinanceCommissions($sales, $employees);

            Cache::forget('dashboard:summary:v2');
        });
    }

    private function clearPreviousFinanceData(): void
    {
        $finMembers = Member::query()->where('email', 'like', 'fin.member.%@gym.test')->pluck('id');
        if ($finMembers->isNotEmpty()) {
            $finSales = Sale::query()->whereIn('member_id', $finMembers)->pluck('id');
            if ($finSales->isNotEmpty()) {
                Commission::query()->where('source_type', Sale::class)->whereIn('source_id', $finSales)->delete();
                Payment::query()->where('payable_type', Sale::class)->whereIn('payable_id', $finSales)->delete();
                SaleItem::query()->whereIn('sale_id', $finSales)->delete();
                Sale::query()->whereIn('id', $finSales)->delete();
            }
            $finSubscriptions = Subscription::query()->whereIn('member_id', $finMembers)->pluck('id');
            if ($finSubscriptions->isNotEmpty()) {
                Commission::query()->where('source_type', Subscription::class)->whereIn('source_id', $finSubscriptions)->delete();
                Payment::query()->where('payable_type', Subscription::class)->whereIn('payable_id', $finSubscriptions)->delete();
                Subscription::query()->whereIn('id', $finSubscriptions)->delete();
            }
        }

        Expense::query()->where('description', 'like', 'Fin:%')->delete();
        Payroll::query()->whereNull('paid_at')->where('status', 'pending')->whereNotIn('employee_id', function ($q): void {
            $q->select('id')->from('employees')->where('status', 'active');
        })->delete();
    }

    /**
     * @return Collection<int, Plan>
     */
    private function ensurePlans(): Collection
    {
        $plans = collect([
            ['name' => 'Fin: Monthly Basic', 'price' => 600, 'duration_days' => 30, 'sessions_count' => null, 'type' => 'membership', 'max_freeze_days' => 3, 'commission_rate' => 0.05],
            ['name' => 'Fin: Monthly Premium', 'price' => 1200, 'duration_days' => 30, 'sessions_count' => 12, 'type' => 'membership', 'max_freeze_days' => 5, 'commission_rate' => 0.07],
            ['name' => 'Fin: Quarterly Plan', 'price' => 3200, 'duration_days' => 90, 'sessions_count' => 36, 'type' => 'membership', 'max_freeze_days' => 10, 'commission_rate' => 0.08],
            ['name' => 'Fin: Half-Year Plan', 'price' => 5800, 'duration_days' => 180, 'sessions_count' => 72, 'type' => 'membership', 'max_freeze_days' => 20, 'commission_rate' => 0.08],
            ['name' => 'Fin: Yearly Elite', 'price' => 10000, 'duration_days' => 365, 'sessions_count' => null, 'type' => 'membership', 'max_freeze_days' => 30, 'commission_rate' => 0.10],
            ['name' => 'Fin: Student Monthly', 'price' => 380, 'duration_days' => 30, 'sessions_count' => null, 'type' => 'offer', 'max_freeze_days' => 2, 'commission_rate' => 0.05],
            ['name' => 'Fin: 10-Session Pack', 'price' => 1500, 'duration_days' => 60, 'sessions_count' => 10, 'type' => 'offer', 'max_freeze_days' => 0, 'commission_rate' => 0.06],
            ['name' => 'Fin: Corporate Group', 'price' => 900, 'duration_days' => 30, 'sessions_count' => null, 'type' => 'membership', 'max_freeze_days' => 5, 'commission_rate' => 0.07],
        ]);

        return $plans->map(fn (array $plan) => Plan::query()->updateOrCreate(
            ['name' => $plan['name']],
            $plan + [
                'description' => 'Finance overview seeded plan.',
                'is_active' => true,
                'valid_from' => null,
                'valid_to' => null,
            ],
        ));
    }

    /**
     * @return Collection<int, Product>
     */
    private function ensureProducts(): Collection
    {
        $catalog = [
            ['Fin: Whey Protein 1KG', 'supplements', 950, 620, 35],
            ['Fin: Creatine 500g', 'supplements', 550, 310, 28],
            ['Fin: Pre-Workout 300g', 'supplements', 680, 420, 20],
            ['Fin: BCAA 400g', 'supplements', 480, 280, 15],
            ['Fin: Protein Bars Box', 'snacks', 320, 180, 60],
            ['Fin: Energy Drink', 'drinks', 55, 22, 120],
            ['Fin: Shaker Bottle Pro', 'accessories', 180, 75, 45],
            ['Fin: Gym Gloves Pro', 'accessories', 260, 120, 30],
            ['Fin: Lifting Belt', 'accessories', 420, 210, 18],
            ['Fin: Resistance Bands', 'accessories', 350, 160, 25],
            ['Fin: Yoga Mat Premium', 'accessories', 480, 240, 16],
            ['Fin: Gym Towel Pack', 'accessories', 140, 55, 80],
            ['Fin: Training Shirt', 'apparel', 380, 180, 22],
            ['Fin: Compression Pants', 'apparel', 520, 260, 14],
            ['Fin: Protein Shake RTD', 'drinks', 85, 42, 90],
            ['Fin: Electrolyte Pack', 'drinks', 40, 16, 110],
            ['Fin: Mass Gainer 2KG', 'supplements', 1600, 1100, 10],
            ['Fin: Omega-3 Capsules', 'supplements', 420, 250, 22],
            ['Fin: Knee Sleeves', 'accessories', 580, 290, 12],
            ['Fin: Wrist Wraps', 'accessories', 200, 85, 28],
        ];

        return collect($catalog)->map(function (array $item, int $index): Product {
            [$name, $category, $price, $cost, $stock] = $item;

            return Product::query()->updateOrCreate(
                ['sku' => 'FIN-'.str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT)],
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
    private function seedFinanceMembers(User $admin): Collection
    {
        $members = collect();
        $totalMembers = array_sum(self::SUBSCRIPTIONS_PER_MONTH);

        for ($i = 1; $i <= $totalMembers; $i++) {
            $monthIndex = $this->monthIndexForRow($i, self::SUBSCRIPTIONS_PER_MONTH);
            $monthAgo = self::MONTHS - 1 - $monthIndex;
            $joinDate = now()->subMonthsNoOverflow($monthAgo)->startOfMonth()->addDays(($i * 3) % 24);

            $members->push(Member::query()->updateOrCreate(
                ['email' => "fin.member.{$i}@gym.test"],
                [
                    'name' => 'Fin Member '.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                    'phone' => '+2016'.str_pad((string) (300000000 + $i), 9, '0', STR_PAD_LEFT),
                    'gender' => ['male', 'female', null][$i % 3],
                    'photo_path' => null,
                    'national_id' => str_pad((string) (49900000000000 + $i), 14, '0', STR_PAD_LEFT),
                    'birth_date' => now()->subYears(rand(18, 52))->subDays(rand(1, 330))->toDateString(),
                    'join_date' => $joinDate->toDateString(),
                    'status' => $i > $totalMembers - 20 ? 'inactive' : 'active',
                    'notes' => null,
                    'created_by' => $admin->id,
                ],
            ));
        }

        return $members;
    }

    /**
     * @param  Collection<int, Member>  $members
     * @param  Collection<int, Plan>  $plans
     * @param  Collection<int, User>  $users
     * @return Collection<int, Subscription>
     */
    private function seedFinanceSubscriptions(Collection $members, Collection $plans, Collection $users, User $admin): Collection
    {
        $subscriptions = collect();
        $memberIndex = 0;

        for ($monthOffset = self::MONTHS - 1; $monthOffset >= 0; $monthOffset--) {
            $monthStart = now()->subMonthsNoOverflow($monthOffset)->startOfMonth();
            $count = self::SUBSCRIPTIONS_PER_MONTH[self::MONTHS - 1 - $monthOffset];

            for ($j = 0; $j < $count; $j++) {
                $member = $members[$memberIndex];
                $plan = $plans[$memberIndex % $plans->count()];
                $memberIndex++;

                $start = $monthStart->copy()->addDays(rand(0, 26));
                $end = $start->copy()->addDays($plan->duration_days);

                $discount = ($memberIndex % 11 === 0) ? rand(50, 300) : 0;
                $pricePaid = max(0, (float) $plan->price - $discount);

                $subscription = Subscription::create([
                    'member_id' => $member->id,
                    'plan_id' => $plan->id,
                    'start_date' => $start->toDateString(),
                    'end_date' => $end->toDateString(),
                    'status' => 'active',
                    'price_paid' => $pricePaid,
                    'discount' => $discount,
                    'sold_by_user_id' => $users->random()->id,
                    'created_by' => $users->random()->id,
                    'last_reminded_on' => null,
                ]);

                $paidAmount = match (true) {
                    ($memberIndex % 15 === 0) => round($pricePaid * rand(35, 55) / 100, 2),
                    ($memberIndex % 19 === 0) => 0,
                    default => $pricePaid,
                };

                $paidAt = $paidAmount > 0
                    ? CarbonImmutable::parse($start)->addHours(rand(8, 21))->addMinutes(rand(0, 59))
                    : null;

                Payment::create([
                    'payable_type' => Subscription::class,
                    'payable_id' => $subscription->id,
                    'amount' => $paidAmount,
                    'method' => ['cash', 'card', 'bank_transfer'][$memberIndex % 3],
                    'status' => $paidAmount <= 0 ? 'due' : ($paidAmount < $pricePaid ? 'partial' : 'paid'),
                    'paid_at' => $paidAt,
                    'due_date' => $paidAmount < $pricePaid ? CarbonImmutable::parse($end)->subDays(rand(3, 8))->toDateString() : null,
                    'created_by' => $admin->id,
                    'created_at' => $paidAt?->toDateTimeString() ?? CarbonImmutable::parse($start)->toDateTimeString(),
                    'updated_at' => $paidAt?->toDateTimeString() ?? CarbonImmutable::parse($start)->toDateTimeString(),
                ]);

                $subscriptions->push($subscription);
            }
        }

        return $subscriptions;
    }

    /**
     * @param  Collection<int, Member>  $members
     * @param  Collection<int, User>  $users
     * @param  Collection<int, Product>  $products
     * @return Collection<int, Sale>
     */
    private function seedFinanceSales(Collection $members, Collection $users, Collection $products, User $admin): Collection
    {
        $sales = collect();
        $saleIndex = 0;

        for ($monthOffset = self::MONTHS - 1; $monthOffset >= 0; $monthOffset--) {
            $monthIdx = self::MONTHS - 1 - $monthOffset;
            $monthStart = now()->subMonthsNoOverflow($monthOffset)->startOfMonth();
            $daysInMonth = $monthStart->daysInMonth;
            $salesThisMonth = self::SALES_PER_MONTH[$monthIdx];

            $salesPerDay = (int) ceil($salesThisMonth / $daysInMonth);
            $saleCounter = 0;

            for ($day = 0; $day < $daysInMonth; $day++) {
                $date = $monthStart->copy()->addDays($day);
                $daySales = $salesPerDay + rand(-2, 3);
                $daySales = max(1, $daySales);

                if ($saleCounter + $daySales > $salesThisMonth) {
                    $daySales = $salesThisMonth - $saleCounter;
                }
                if ($daySales <= 0) {
                    break;
                }

                for ($s = 0; $s < $daySales; $s++) {
                    $hour = $this->pickSalesHour();
                    $minute = rand(0, 59);
                    $soldAt = $date->copy()->setTime($hour, $minute);

                    $itemCount = $this->pickItemCount();
                    $selectedProducts = $products->random(min($itemCount, $products->count()));
                    if ($selectedProducts instanceof Product) {
                        $selectedProducts = collect([$selectedProducts]);
                    }

                    $discount = ($saleIndex % 14 === 0) ? 0 : 0;
                    $subtotal = 0;
                    $totalUnits = 0;

                    $sale = Sale::create([
                        'idempotency_key' => (string) Str::uuid(),
                        'member_id' => $members->random()->id,
                        'sold_by_user_id' => $users->random()->id,
                        'subtotal' => 0,
                        'discount' => 0,
                        'total' => 0,
                        'payment_method' => $this->pickPaymentMethod(),
                        'status' => 'completed',
                        'notes' => null,
                    ]);

                    foreach ($selectedProducts as $product) {
                        $quantity = rand(1, 4);
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

                    if ($saleIndex % 14 === 0) {
                        $discount = round($subtotal * rand(5, 15) / 100, 2);
                    }
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

                    $sales->push($sale);
                    $saleIndex++;
                    $saleCounter++;
                }
            }
        }

        return $sales;
    }

    private function seedFinanceExpenses(User $admin): void
    {
        $baseCategories = [
            'rent' => ['Fin: Gym rent for branch', 15000, 18000],
            'utilities' => ['Fin: electricity + water', 2800, 5500],
            'maintenance' => ['Fin: equipment maintenance', 1500, 7000],
            'marketing' => ['Fin: social media + ads', 2000, 8500],
            'cleaning' => ['Fin: cleaning supplies + service', 1000, 2800],
            'software' => ['Fin: systems + subscriptions', 800, 2500],
            'payroll' => ['Fin: payroll operations cost', 500, 1500],
        ];

        $extraExpenseLabels = [
            ['supplies', 'Fin: office supplies restock', 200, 600],
            ['training', 'Fin: staff training workshop', 800, 2500],
            ['renovation', 'Fin: minor facility renovation', 2500, 8000],
            ['events', 'Fin: member event costs', 1500, 4000],
            ['insurance', 'Fin: liability insurance', 1200, 3000],
            ['transport', 'Fin: delivery + logistics', 300, 900],
        ];

        for ($monthOffset = self::MONTHS - 1; $monthOffset >= 0; $monthOffset--) {
            $monthIdx = self::MONTHS - 1 - $monthOffset;
            $month = now()->subMonthsNoOverflow($monthOffset)->startOfMonth();
            $growth = self::GROWTH_CURVE[$monthIdx];
            $extraCount = max(0, self::EXPENSES_PER_MONTH[$monthIdx] - count($baseCategories));

            foreach ($baseCategories as $category => [$desc, $min, $max]) {
                Expense::create([
                    'category' => $category,
                    'amount' => round(rand($min, $max) * $growth, 2),
                    'description' => $desc,
                    'date' => $month->copy()->addDays(rand(1, 25))->toDateString(),
                    'created_by' => $admin->id,
                ]);
            }

            for ($e = 0; $e < $extraCount; $e++) {
                $extra = $extraExpenseLabels[$e % count($extraExpenseLabels)];
                Expense::create([
                    'category' => $extra[0],
                    'amount' => round(rand($extra[2], $extra[3]) * $growth, 2),
                    'description' => $extra[1],
                    'date' => $month->copy()->addDays(rand(1, 25))->toDateString(),
                    'created_by' => $admin->id,
                ]);
            }
        }
    }

    /**
     * @param  Collection<int, Employee>  $employees
     */
    private function seedFinancePayroll(Collection $employees): void
    {
        for ($monthOffset = self::MONTHS - 1; $monthOffset >= 0; $monthOffset--) {
            $month = now()->subMonthsNoOverflow($monthOffset);
            $monthKey = $month->format('Y-m');
            $isCurrentMonth = $month->isCurrentMonth();
            $isPreviousMonth = $month->format('Y-m') === now()->subMonthNoOverflow()->format('Y-m');

            $employees->each(function (Employee $employee, int $index) use ($month, $monthKey, $isCurrentMonth, $isPreviousMonth): void {
                $alreadyExists = Payroll::query()
                    ->where('employee_id', $employee->id)
                    ->where('month', $monthKey)
                    ->exists();

                if ($alreadyExists) {
                    return;
                }

                $commissions = Commission::query()
                    ->where('employee_id', $employee->id)
                    ->where('month', $monthKey)
                    ->where('status', 'pending')
                    ->sum('amount');

                $commissions += Commission::query()
                    ->where('employee_id', $employee->id)
                    ->where('month', $monthKey)
                    ->where('status', 'paid')
                    ->sum('amount');

                $attendanceDeductions = round((float) $employee->base_salary * rand(0, 4) / 100, 2);
                $bonuses = ($index + (int) $month->format('m')) % 4 === 0 ? rand(200, 800) : 0;
                $manualDeductions = $index % 7 === 0 ? rand(80, 300) : 0;
                $netSalary = round((float) $employee->base_salary + (float) $commissions + $bonuses - $manualDeductions - $attendanceDeductions, 2);

                $isOpenPayroll = $isCurrentMonth || ($isPreviousMonth && $index % 5 === 0);

                Payroll::create([
                    'employee_id' => $employee->id,
                    'month' => $monthKey,
                    'base_salary' => $employee->base_salary,
                    'commissions_total' => $commissions,
                    'bonuses' => $bonuses,
                    'deductions' => $manualDeductions,
                    'attendance_deductions' => $attendanceDeductions,
                    'attendance_snapshot' => [
                        'present_days' => rand(20, 26),
                        'late_days' => rand(0, 4),
                        'absence_days' => rand(0, 2),
                    ],
                    'net_salary' => $netSalary,
                    'status' => $isOpenPayroll ? 'pending' : 'paid',
                    'paid_at' => $isOpenPayroll ? null : $month->copy()->endOfMonth()->subDays(rand(0, 3)),
                    'created_at' => $month->copy()->endOfMonth()->subDays(rand(0, 5))->toDateTimeString(),
                    'updated_at' => $month->copy()->endOfMonth()->subDays(rand(0, 2))->toDateTimeString(),
                ]);
            });
        }
    }

    /**
     * @param  Collection<int, Sale>  $sales
     * @param  Collection<int, Employee>  $employees
     */
    private function seedFinanceCommissions(Collection $sales, Collection $employees): void
    {
        $captains = $employees->where('role', 'captain')->values();
        if ($captains->isEmpty()) {
            $captains = $employees->values();
        }

        $sales->take(600)->each(function (Sale $sale, int $index) use ($captains): void {
            $employee = $captains[$index % $captains->count()];
            $rate = (float) ($employee->commission_rate ?: 0.07);
            $month = CarbonImmutable::parse($sale->created_at)->format('Y-m');

            $alreadyExists = Commission::query()
                ->where('source_type', Sale::class)
                ->where('source_id', $sale->id)
                ->exists();

            if ($alreadyExists) {
                return;
            }

            Commission::create([
                'employee_id' => $employee->id,
                'source_type' => Sale::class,
                'source_id' => $sale->id,
                'rate' => $rate,
                'amount' => round((float) $sale->total * $rate, 2),
                'month' => $month,
                'status' => $index % 4 === 0 ? 'paid' : 'pending',
            ]);
        });
    }

    /**
     * Map a row index to which month bucket it belongs to.
     */
    private function monthIndexForRow(int $rowIndex, array $counts): int
    {
        $cumulative = 0;
        foreach ($counts as $idx => $cnt) {
            $cumulative += $cnt;
            if ($rowIndex <= $cumulative) {
                return $idx;
            }
        }

        return count($counts) - 1;
    }

    /**
     * Pick an hour weighted by realistic gym sales patterns.
     * Peaks: morning (8-10), lunch (12-14), evening (17-20).
     */
    private function pickSalesHour(): int
    {
        $roll = rand(1, 100);

        return match (true) {
            $roll <= 5 => rand(6, 7),
            $roll <= 20 => rand(8, 10),
            $roll <= 25 => 11,
            $roll <= 38 => rand(12, 14),
            $roll <= 47 => rand(15, 16),
            $roll <= 80 => rand(17, 20),
            $roll <= 90 => rand(21, 22),
            default => 23,
        };
    }

    /**
     * Weighted item count per sale (most sales are 1-2 items).
     */
    private function pickItemCount(): int
    {
        $roll = rand(1, 100);

        return match (true) {
            $roll <= 45 => 1,
            $roll <= 75 => 2,
            $roll <= 90 => 3,
            default => 4,
        };
    }

    /**
     * Weighted payment method distribution: cash ~45%, card ~40%, bank_transfer ~15%.
     */
    private function pickPaymentMethod(): string
    {
        $roll = rand(1, 100);

        return match (true) {
            $roll <= 45 => 'cash',
            $roll <= 85 => 'card',
            default => 'bank_transfer',
        };
    }
}
