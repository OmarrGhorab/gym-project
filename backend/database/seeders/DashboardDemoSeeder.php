<?php

namespace Database\Seeders;

use App\Models\Attendance;
use App\Models\AttendanceViolation;
use App\Models\AttendanceViolationRule;
use App\Models\Commission;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Expense;
use App\Models\GymTask;
use App\Models\GymTaskComment;
use App\Models\InventoryMovement;
use App\Models\Member;
use App\Models\MemberVisit;
use App\Models\OperationsCalendarEvent;
use App\Models\Payment;
use App\Models\Payroll;
use App\Models\Plan;
use App\Models\Product;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Subscription;
use App\Models\SubscriptionFreeze;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Seed a dense gym demo dataset for dashboard, calendar, task, POS, finance,
 * attendance, payroll, inventory, and reporting screens.
 */
class DashboardDemoSeeder extends Seeder
{
    private const GYM_LATITUDE = 30.0444200;

    private const GYM_LONGITUDE = 31.2357120;

    public function run(): void
    {
        DB::transaction(function (): void {
            $admin = User::where('email', 'admin@gym.test')->firstOrFail();
            $cashier = User::where('email', 'cashier@gym.test')->firstOrFail();
            $manager = User::where('email', 'manager@gym.test')->firstOrFail();
            $users = collect([$admin, $cashier, $manager]);

            $this->clearPreviousDemoData();

            $plans = $this->seedPlans();
            $shifts = $this->seedShifts();
            $employees = $this->seedEmployees($users, $shifts);
            $members = $this->seedMembers($admin);
            $subscriptions = $this->seedSubscriptions($members, $plans, $users);
            $this->seedSubscriptionPayments($subscriptions, $admin);

            $products = $this->seedProducts();
            $sales = $this->seedSales($members, $users, $products, $admin);
            $this->seedCommissions($sales, $employees);
            $this->seedInventoryAndPurchaseOrders($products, $users);
            $this->seedAttendance($employees, $shifts, $admin);
            $this->seedMemberVisits($subscriptions, $members, $admin);
            $this->seedPayroll($employees);
            $this->seedExpenses($admin);
            $this->seedCalendarEvents($employees, $admin);
            $this->seedGymTasks($employees, $users);
            $this->seedNotifications($admin);

            Cache::forget('dashboard:summary:v2');
        });
    }

    private function clearPreviousDemoData(): void
    {
        $demoMembers = Member::query()->where('email', 'like', 'demo.member.%@gym.test')->pluck('id');
        if ($demoMembers->isNotEmpty()) {
            $demoSales = Sale::query()->whereIn('member_id', $demoMembers)->pluck('id');
            if ($demoSales->isNotEmpty()) {
                Payment::query()
                    ->where('payable_type', Sale::class)
                    ->whereIn('payable_id', $demoSales)
                    ->delete();
                SaleItem::query()->whereIn('sale_id', $demoSales)->delete();
                Sale::query()->whereIn('id', $demoSales)->delete();
            }

            $demoSubscriptions = Subscription::query()->whereIn('member_id', $demoMembers)->pluck('id');
            if ($demoSubscriptions->isNotEmpty()) {
                Payment::query()
                    ->where('payable_type', Subscription::class)
                    ->whereIn('payable_id', $demoSubscriptions)
                    ->delete();
                SubscriptionFreeze::query()->whereIn('subscription_id', $demoSubscriptions)->delete();
                Subscription::query()->whereIn('id', $demoSubscriptions)->delete();
            }

            MemberVisit::query()->whereIn('member_id', $demoMembers)->delete();
        }

        GymTask::query()->where('title', 'like', 'Demo:%')->delete();
        OperationsCalendarEvent::query()->where('title', 'like', 'Demo:%')->delete();
        PurchaseOrder::query()->where('reference', 'like', 'DEMO-PO-%')->delete();
        Expense::query()->where('description', 'like', 'Demo:%')->delete();

        $demoProducts = Product::query()->where('sku', 'like', 'DEMO-%')->pluck('id');
        if ($demoProducts->isNotEmpty()) {
            InventoryMovement::query()->whereIn('product_id', $demoProducts)->delete();
        }

        $demoEmployees = Employee::query()->where('phone', 'like', '+2015500%')->pluck('id');
        if ($demoEmployees->isNotEmpty()) {
            AttendanceViolation::query()->whereIn('employee_id', $demoEmployees)->delete();
            Attendance::query()->whereIn('employee_id', $demoEmployees)->delete();
            Payroll::query()->whereIn('employee_id', $demoEmployees)->delete();
            Commission::query()->whereIn('employee_id', $demoEmployees)->delete();
        }
    }

    /**
     * @return Collection<int, Plan>
     */
    private function seedPlans(): Collection
    {
        $plans = collect([
            ['name' => 'Demo: Monthly Gym Access', 'price' => 650, 'duration_days' => 30, 'sessions_count' => null, 'type' => 'membership', 'max_freeze_days' => 5],
            ['name' => 'Demo: Premium Monthly PT', 'price' => 1450, 'duration_days' => 30, 'sessions_count' => 8, 'type' => 'membership', 'max_freeze_days' => 7],
            ['name' => 'Demo: Quarterly Transformation', 'price' => 3600, 'duration_days' => 90, 'sessions_count' => 24, 'type' => 'membership', 'max_freeze_days' => 14],
            ['name' => 'Demo: Student Off-Peak', 'price' => 420, 'duration_days' => 30, 'sessions_count' => null, 'type' => 'offer', 'max_freeze_days' => 3],
            ['name' => 'Demo: Yearly VIP', 'price' => 12000, 'duration_days' => 365, 'sessions_count' => 96, 'type' => 'membership', 'max_freeze_days' => 30],
            ['name' => 'Demo: 12 Session Pack', 'price' => 1800, 'duration_days' => 45, 'sessions_count' => 12, 'type' => 'offer', 'max_freeze_days' => 0],
            ['name' => 'Demo: Weekend Warrior', 'price' => 520, 'duration_days' => 30, 'sessions_count' => 10, 'type' => 'offer', 'max_freeze_days' => 2],
            ['name' => 'Demo: Corporate Plan', 'price' => 950, 'duration_days' => 30, 'sessions_count' => null, 'type' => 'membership', 'max_freeze_days' => 5],
        ]);

        return $plans->map(fn (array $plan) => Plan::query()->updateOrCreate(
            ['name' => $plan['name']],
            $plan + [
                'description' => 'Seeded plan for dashboard demos.',
                'is_active' => true,
                'valid_from' => null,
                'valid_to' => null,
            ],
        ));
    }

    /**
     * @return Collection<int, EmployeeShift>
     */
    private function seedShifts(): Collection
    {
        return collect([
            ['name' => 'Demo: Morning 09-17', 'starts_at' => '09:00', 'ends_at' => '17:00', 'grace_minutes' => 15],
            ['name' => 'Demo: Evening 14-22', 'starts_at' => '14:00', 'ends_at' => '22:00', 'grace_minutes' => 10],
            ['name' => 'Demo: Night 22-06', 'starts_at' => '22:00', 'ends_at' => '06:00', 'grace_minutes' => 20],
            ['name' => 'Demo: Weekend 10-18', 'starts_at' => '10:00', 'ends_at' => '18:00', 'grace_minutes' => 15],
        ])->map(fn (array $shift) => EmployeeShift::query()->updateOrCreate(
            ['name' => $shift['name']],
            $shift + ['is_active' => true],
        ));
    }

    /**
     * @param  Collection<int, User>  $users
     * @param  Collection<int, EmployeeShift>  $shifts
     * @return Collection<int, Employee>
     */
    private function seedEmployees(Collection $users, Collection $shifts): Collection
    {
        $roles = [
            ['name' => 'Demo Staff: Omar Fitness Captain', 'role' => 'captain', 'salary' => 7200, 'rate' => 0.08],
            ['name' => 'Demo Staff: Mariam Front Desk', 'role' => 'employee', 'salary' => 4200, 'rate' => 0],
            ['name' => 'Demo Staff: Youssef Sales Coach', 'role' => 'captain', 'salary' => 6500, 'rate' => 0.10],
            ['name' => 'Demo Staff: Salma Operations Manager', 'role' => 'manager', 'salary' => 9500, 'rate' => 0],
            ['name' => 'Demo Staff: Karim Floor Trainer', 'role' => 'captain', 'salary' => 5800, 'rate' => 0.07],
            ['name' => 'Demo Staff: Nada Reception', 'role' => 'employee', 'salary' => 3900, 'rate' => 0],
            ['name' => 'Demo Staff: Hany Inventory', 'role' => 'employee', 'salary' => 4600, 'rate' => 0],
            ['name' => 'Demo Staff: Farida PT Coach', 'role' => 'captain', 'salary' => 7000, 'rate' => 0.09],
            ['name' => 'Demo Staff: Tarek Night Guard', 'role' => 'employee', 'salary' => 4100, 'rate' => 0],
            ['name' => 'Demo Staff: Laila Pilates Coach', 'role' => 'captain', 'salary' => 6800, 'rate' => 0.08],
            ['name' => 'Demo Staff: Mina Maintenance', 'role' => 'employee', 'salary' => 4300, 'rate' => 0],
            ['name' => 'Demo Staff: Jana Membership Advisor', 'role' => 'employee', 'salary' => 5000, 'rate' => 0.04],
        ];

        return collect($roles)->map(function (array $employee, int $index) use ($shifts): Employee {
            return Employee::query()->updateOrCreate(
                ['phone' => '+2015500'.str_pad((string) ($index + 1), 5, '0', STR_PAD_LEFT)],
                [
                    'user_id' => null,
                    'name' => $employee['name'],
                    'role' => $employee['role'],
                    'base_salary' => $employee['salary'],
                    'commission_rate' => $employee['rate'],
                    'shift_id' => $shifts[$index % $shifts->count()]->id,
                    'hire_date' => now()->subDays(120 + ($index * 15))->toDateString(),
                    'status' => $index === 10 ? 'inactive' : 'active',
                ],
            );
        });
    }

    /**
     * @return Collection<int, Member>
     */
    private function seedMembers(User $admin): Collection
    {
        $members = collect();

        for ($i = 1; $i <= 360; $i++) {
            $joinDate = now()
                ->subMonthsNoOverflow(11 - (($i - 1) % 12))
                ->startOfMonth()
                ->addDays(($i * 3) % 24);

            $members->push(Member::query()->updateOrCreate(
                ['email' => "demo.member.{$i}@gym.test"],
                [
                    'name' => 'Demo Member '.str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                    'phone' => '+2015'.str_pad((string) (200000000 + $i), 9, '0', STR_PAD_LEFT),
                    'gender' => ['male', 'female', null][$i % 3],
                    'photo_path' => null,
                    'national_id' => str_pad((string) (39900000000000 + $i), 14, '0', STR_PAD_LEFT),
                    'birth_date' => now()->subYears(rand(18, 49))->subDays(rand(1, 330))->toDateString(),
                    'join_date' => $joinDate->toDateString(),
                    'status' => $i > 224 ? 'inactive' : 'active',
                    'notes' => $i % 17 === 0 ? 'Demo: prefers evening classes.' : null,
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
    private function seedSubscriptions(Collection $members, Collection $plans, Collection $users): Collection
    {
        return $members->map(function (Member $member, int $index) use ($plans, $users): Subscription {
            $plan = $plans[$index % $plans->count()];
            $monthOffset = 11 - ($index % 12);
            $monthStart = now()->subMonthsNoOverflow($monthOffset)->startOfMonth();
            $status = match (true) {
                $index < 150 => 'active',
                $index < 174 => 'frozen',
                $index < 210 => 'expired',
                $index < 228 => 'stopped',
                default => 'active',
            };

            $start = $monthStart->copy()->addDays(($index * 2) % 24);
            $end = match ($status) {
                'expired' => $start->copy()->addDays(max(14, min($plan->duration_days, 45))),
                'stopped' => $start->copy()->addDays(max(14, min($plan->duration_days, 60))),
                default => $start->copy()->addDays($plan->duration_days),
            };

            if ($status === 'active' && $index < 28) {
                $start = now()->subDays(rand(1, 20));
                $end = now()->addDays(rand(1, 7));
            } elseif ($status === 'active' && $end->isPast()) {
                $cycleStart = now()->subDays(rand(0, 18));
                $start = $cycleStart;
                $end = $cycleStart->copy()->addDays($plan->duration_days);
            } elseif ($status === 'frozen' && $end->isPast()) {
                $start = now()->subDays(rand(8, 24));
                $end = now()->addDays(rand(10, 35));
            }

            $discount = $index % 9 === 0 ? rand(50, 250) : 0;
            $pricePaid = max(0, (float) $plan->price - $discount);

            $subscription = Subscription::create([
                'member_id' => $member->id,
                'plan_id' => $plan->id,
                'start_date' => $start->toDateString(),
                'end_date' => $end->toDateString(),
                'status' => $status,
                'price_paid' => $pricePaid,
                'discount' => $discount,
                'sold_by_user_id' => $users->random()->id,
                'created_by' => $users->random()->id,
                'last_reminded_on' => $index % 8 === 0 ? now()->subDays(rand(1, 5))->toDateString() : null,
            ]);
            $subscription->forceFill([
                'created_at' => $start,
                'updated_at' => $start,
            ])->save();

            if ($status === 'frozen') {
                $freezeStart = now()->subDays(rand(1, 3));
                $freezeEnd = now()->addDays(rand(3, 10));

                SubscriptionFreeze::create([
                    'subscription_id' => $subscription->id,
                    'freeze_start' => $freezeStart->toDateString(),
                    'freeze_end' => $freezeEnd->toDateString(),
                    'days' => $freezeStart->diffInDays($freezeEnd) + 1,
                    'reason' => 'Demo: travel / medical pause',
                    'created_by' => $users->random()->id,
                ]);
            }

            return $subscription;
        });
    }

    /**
     * @param  Collection<int, Subscription>  $subscriptions
     */
    private function seedSubscriptionPayments(Collection $subscriptions, User $admin): void
    {
        $subscriptions->each(function (Subscription $subscription, int $index) use ($admin): void {
            $amount = (float) $subscription->price_paid;
            $paidAmount = match (true) {
                $index % 13 === 0 => round($amount * 0.55, 2),
                $index % 11 === 0 => 0,
                default => $amount,
            };

            $paidAt = $paidAmount > 0 ? CarbonImmutable::parse($subscription->start_date)->addHours(rand(9, 22))->addMinutes(rand(0, 59)) : null;

            Payment::create([
                'payable_type' => Subscription::class,
                'payable_id' => $subscription->id,
                'amount' => $paidAmount,
                'method' => ['cash', 'card', 'bank_transfer', 'wallet'][$index % 4],
                'status' => $paidAmount <= 0 ? 'due' : ($paidAmount < $amount ? 'partial' : 'paid'),
                'paid_at' => $paidAt,
                'due_date' => $paidAmount < $amount ? CarbonImmutable::parse($subscription->end_date)->subDays(rand(1, 6))->toDateString() : null,
                'created_by' => $admin->id,
                'created_at' => $paidAt ?? CarbonImmutable::parse($subscription->start_date),
                'updated_at' => $paidAt ?? CarbonImmutable::parse($subscription->start_date),
            ]);
        });
    }

    /**
     * @return Collection<int, Product>
     */
    private function seedProducts(): Collection
    {
        $catalog = [
            ['Protein Shake Vanilla', 'drinks', 95, 52, 80],
            ['Protein Shake Chocolate', 'drinks', 95, 52, 75],
            ['Electrolyte Water', 'drinks', 45, 18, 120],
            ['Cold Brew Coffee', 'drinks', 70, 30, 55],
            ['Whey Protein 2KG', 'supplements', 1850, 1320, 22],
            ['Creatine Monohydrate', 'supplements', 780, 470, 18],
            ['Pre Workout Citrus', 'supplements', 920, 620, 12],
            ['BCAA Berry', 'supplements', 650, 410, 8],
            ['Gym Gloves Black', 'accessories', 240, 115, 45],
            ['Lifting Straps', 'accessories', 190, 80, 38],
            ['Resistance Band Set', 'accessories', 360, 170, 30],
            ['Shaker Bottle', 'accessories', 160, 65, 65],
            ['Gym Towel', 'accessories', 130, 55, 90],
            ['Training T-Shirt', 'apparel', 420, 210, 28],
            ['Compression Shorts', 'apparel', 480, 240, 20],
            ['Yoga Mat', 'accessories', 520, 270, 16],
            ['Knee Sleeves', 'accessories', 690, 360, 11],
            ['Protein Bar Peanut', 'snacks', 55, 25, 140],
            ['Protein Bar Brownie', 'snacks', 55, 25, 130],
            ['Energy Gel', 'snacks', 40, 18, 95],
            ['Mass Gainer 3KG', 'supplements', 2100, 1550, 7],
            ['Foam Roller', 'accessories', 390, 190, 14],
            ['Skipping Rope', 'accessories', 180, 75, 52],
            ['Sports Cap', 'apparel', 260, 120, 26],
            ['Wrist Wraps', 'accessories', 220, 90, 33],
            ['Zero Sugar Soda', 'drinks', 38, 14, 105],
            ['Greek Yogurt Cup', 'snacks', 65, 34, 60],
            ['Meal Prep Chicken', 'snacks', 150, 95, 32],
            ['Smart Scale Battery', 'accessories', 85, 38, 9],
            ['Locker Padlock', 'accessories', 110, 45, 24],
            ['Demo Low Stock Magnesium', 'supplements', 430, 230, 2],
            ['Demo Low Stock Towels', 'accessories', 125, 55, 3],
            ['Demo Out Stock Creatine', 'supplements', 800, 500, 0],
        ];

        return collect($catalog)->map(function (array $item, int $index): Product {
            [$name, $category, $price, $cost, $stock] = $item;

            return Product::query()->updateOrCreate(
                ['sku' => 'DEMO-'.str_pad((string) ($index + 1), 4, '0', STR_PAD_LEFT)],
                [
                    'name' => 'Demo: '.$name,
                    'category' => $category,
                    'price' => $price,
                    'cost' => $cost,
                    'stock_quantity' => $stock,
                    'low_stock_threshold' => $index > 29 ? 5 : 10,
                    'image' => null,
                    'is_active' => $index !== 32,
                ],
            );
        });
    }

    /**
     * @param  Collection<int, Member>  $members
     * @param  Collection<int, User>  $users
     * @param  Collection<int, Product>  $products
     * @return Collection<int, Sale>
     */
    private function seedSales(Collection $members, Collection $users, Collection $products, User $admin): Collection
    {
        $sales = collect();

        for ($i = 0; $i < 1800; $i++) {
            $dayOffset = $i < 40 ? rand(0, 2) : (($i * 7) % 365);
            $soldAt = now()->subDays($dayOffset)->startOfDay()->addHours(rand(7, 22))->addMinutes(rand(0, 59));

            $selectedProducts = $products->random(rand(1, 4));
            $subtotal = 0;
            $discount = $i % 17 === 0 ? rand(20, 120) : 0;
            $sale = Sale::create([
                'idempotency_key' => (string) Str::uuid(),
                'member_id' => $members->random()->id,
                'sold_by_user_id' => $users->random()->id,
                'subtotal' => 0,
                'discount' => $discount,
                'total' => 0,
                'payment_method' => ['cash', 'card', 'bank_transfer', 'wallet'][$i % 4],
                'status' => 'completed',
                'notes' => $i % 21 === 0 ? 'Demo: combo sale after class.' : null,
            ]);

            foreach ($selectedProducts as $product) {
                $quantity = rand(1, 3);
                $lineTotal = round((float) $product->price * $quantity, 2);
                $subtotal += $lineTotal;
                SaleItem::create([
                    'sale_id' => $sale->id,
                    'product_id' => $product->id,
                    'quantity' => $quantity,
                    'unit_price' => $product->price,
                    'total' => $lineTotal,
                ]);
            }

            $total = max(0, round($subtotal - $discount, 2));
            $sale->forceFill([
                'subtotal' => $subtotal,
                'total' => $total,
                'created_at' => $soldAt,
                'updated_at' => $soldAt,
            ])->save();

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
        }

        return $sales;
    }

    /**
     * @param  Collection<int, Sale>  $sales
     * @param  Collection<int, Employee>  $employees
     */
    private function seedCommissions(Collection $sales, Collection $employees): void
    {
        $captains = $employees->where('role', 'captain')->values();

        $sales->take(80)->each(function (Sale $sale, int $index) use ($captains): void {
            $employee = $captains[$index % $captains->count()];
            $rate = (float) ($employee->commission_rate ?: 0.07);

            Commission::create([
                'employee_id' => $employee->id,
                'source_type' => Sale::class,
                'source_id' => $sale->id,
                'rate' => $rate,
                'amount' => round((float) $sale->total * $rate, 2),
                'month' => CarbonImmutable::parse($sale->created_at)->format('Y-m'),
                'status' => $index % 5 === 0 ? 'paid' : 'pending',
            ]);
        });
    }

    /**
     * @param  Collection<int, Product>  $products
     * @param  Collection<int, User>  $users
     */
    private function seedInventoryAndPurchaseOrders(Collection $products, Collection $users): void
    {
        $suppliers = ['Cairo Fit Supply', 'Delta Nutrition', 'Active Gear Egypt', 'Peak Performance Wholesale'];

        for ($i = 1; $i <= 27; $i++) {
            $status = ['draft', 'ordered', 'delayed', 'cancelled', 'received', 'partial'][$i % 6];
            $orderedAt = now()->subDays(rand(1, 70))->toDateString();
            $expectedAt = now()->addDays(rand(-8, 14))->toDateString();
            $orderProducts = $products->random(rand(2, 5));
            $subtotal = 0;

            $purchaseOrder = PurchaseOrder::create([
                'reference' => 'DEMO-PO-'.str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                'supplier_name' => $suppliers[$i % count($suppliers)],
                'supplier_phone' => '+202'.rand(10000000, 99999999),
                'ordered_at' => $orderedAt,
                'expected_at' => $expectedAt,
                'received_at' => in_array($status, ['received', 'partial'], true) ? now()->subDays(rand(0, 5)) : null,
                'status' => $status,
                'subtotal' => 0,
                'notes' => 'Demo: inventory planning order.',
                'created_by' => $users->random()->id,
                'received_by' => in_array($status, ['received', 'partial'], true) ? $users->random()->id : null,
            ]);

            foreach ($orderProducts as $product) {
                $quantityOrdered = rand(8, 40);
                $quantityReceived = match ($status) {
                    'received' => $quantityOrdered,
                    'partial' => rand(1, max(1, $quantityOrdered - 1)),
                    default => 0,
                };
                $lineTotal = round((float) $product->cost * $quantityOrdered, 2);
                $subtotal += $lineTotal;

                PurchaseOrderItem::create([
                    'purchase_order_id' => $purchaseOrder->id,
                    'product_id' => $product->id,
                    'quantity_ordered' => $quantityOrdered,
                    'quantity_received' => $quantityReceived,
                    'unit_cost' => $product->cost,
                    'line_total' => $lineTotal,
                ]);

                if ($quantityReceived > 0) {
                    InventoryMovement::create([
                        'product_id' => $product->id,
                        'type' => 'in',
                        'quantity' => $quantityReceived,
                        'reason' => 'Demo: purchase order received',
                        'created_by' => $purchaseOrder->received_by,
                    ]);
                }
            }

            $purchaseOrder->update(['subtotal' => $subtotal]);
        }

        $products->take(30)->each(function (Product $product, int $index) use ($users): void {
            InventoryMovement::create([
                'product_id' => $product->id,
                'type' => $index % 4 === 0 ? 'adjustment' : 'out',
                'quantity' => rand(1, 8),
                'reason' => $index % 4 === 0 ? 'Demo: stock count adjustment' : 'Demo: POS stock deduction',
                'created_by' => $users->random()->id,
            ]);
        });
    }

    /**
     * @param  Collection<int, Employee>  $employees
     * @param  Collection<int, EmployeeShift>  $shifts
     */
    private function seedAttendance(Collection $employees, Collection $shifts, User $admin): void
    {
        $rules = AttendanceViolationRule::query()->get()->keyBy('code');
        $activeEmployees = $employees->where('status', 'active')->values();

        for ($day = 0; $day < 38; $day++) {
            $date = CarbonImmutable::now()->subDays($day);
            if ($date->isFriday()) {
                continue;
            }

            $activeEmployees->each(function (Employee $employee, int $index) use ($date, $rules, $admin): void {
                $shift = $employee->shift ?: EmployeeShift::query()->first();
                $statusRoll = ($date->day + $index) % 16;
                $isAbsent = $statusRoll === 0;
                $isLate = in_array($statusRoll, [3, 7, 11], true);
                $isEarlyLeave = $statusRoll === 5;
                $isOffShift = $statusRoll === 9;
                $lateMinutes = $isLate ? [18, 35, 70][($date->day + $index) % 3] : 0;
                $earlyLeaveMinutes = $isEarlyLeave ? rand(20, 55) : 0;

                $checkIn = $isAbsent ? null : $date->setTimeFromTimeString($shift->starts_at->format('H:i'))->addMinutes($lateMinutes)->addMinutes($isOffShift ? 90 : rand(-5, 8));
                $checkOut = $isAbsent ? null : $date->setTimeFromTimeString($shift->ends_at->format('H:i'))->subMinutes($earlyLeaveMinutes)->addMinutes(rand(-8, 20));

                $attendance = Attendance::create([
                    'employee_id' => $employee->id,
                    'shift_id' => $shift->id,
                    'date' => $date->toDateString(),
                    'check_in' => $checkIn,
                    'check_in_latitude' => $isAbsent ? null : self::GYM_LATITUDE + (rand(-12, 12) / 100000),
                    'check_in_longitude' => $isAbsent ? null : self::GYM_LONGITUDE + (rand(-12, 12) / 100000),
                    'check_in_accuracy_meters' => $isAbsent ? null : rand(8, 38),
                    'check_in_distance_meters' => $isAbsent ? null : ($isOffShift ? rand(40, 160) : rand(2, 45)),
                    'check_in_location_status' => $isAbsent ? null : ($isOffShift ? 'flagged' : 'inside'),
                    'check_out' => $checkOut,
                    'check_out_latitude' => $isAbsent ? null : self::GYM_LATITUDE + (rand(-12, 12) / 100000),
                    'check_out_longitude' => $isAbsent ? null : self::GYM_LONGITUDE + (rand(-12, 12) / 100000),
                    'check_out_accuracy_meters' => $isAbsent ? null : rand(8, 40),
                    'check_out_distance_meters' => $isAbsent ? null : rand(2, 65),
                    'check_out_location_status' => $isAbsent ? null : 'inside',
                    'status' => $isAbsent ? 'absent' : ($isLate ? 'late' : 'present'),
                    'scan_method' => $isAbsent ? 'manual' : 'qr',
                    'schedule_status' => $isOffShift ? 'off_shift' : 'on_shift',
                    'approval_status' => $isOffShift ? 'pending' : 'approved',
                    'late_minutes' => $lateMinutes,
                    'early_leave_minutes' => $earlyLeaveMinutes,
                    'notes' => $isAbsent ? 'Demo: absent day for payroll warning.' : null,
                ]);

                $this->maybeSeedAttendanceViolation($attendance, $employee, $rules, $admin);
            });
        }
    }

    /**
     * @param  Collection<string, AttendanceViolationRule>  $rules
     */
    private function maybeSeedAttendanceViolation(Attendance $attendance, Employee $employee, Collection $rules, User $admin): void
    {
        $rule = null;
        $type = null;
        $minutes = null;

        if ($attendance->status === 'absent') {
            $rule = $rules->get('absence');
            $type = 'absence';
        } elseif ($attendance->late_minutes >= 60) {
            $rule = $rules->get('late_60');
            $type = 'late';
            $minutes = $attendance->late_minutes;
        } elseif ($attendance->late_minutes >= 30) {
            $rule = $rules->get('late_30');
            $type = 'late';
            $minutes = $attendance->late_minutes;
        } elseif ($attendance->late_minutes >= 15) {
            $rule = $rules->get('late_15');
            $type = 'late';
            $minutes = $attendance->late_minutes;
        } elseif ($attendance->early_leave_minutes > 0) {
            $rule = $rules->get('early_leave');
            $type = 'early_leave';
            $minutes = $attendance->early_leave_minutes;
        } elseif ($attendance->schedule_status === 'off_shift') {
            $rule = $rules->get('off_shift');
            $type = 'off_shift';
        }

        if (! $rule || ! $type) {
            return;
        }

        $dailySalary = ((float) $employee->base_salary) / 30;
        $deductionAmount = round($dailySalary * (float) $rule->deduction_days, 2);
        $status = ['pending', 'approved', 'dismissed', 'auto_applied'][$attendance->id % 4];

        AttendanceViolation::create([
            'employee_id' => $employee->id,
            'attendance_id' => $attendance->id,
            'attendance_violation_rule_id' => $rule->id,
            'payroll_id' => null,
            'violation_date' => $attendance->date,
            'type' => $type,
            'minutes' => $minutes,
            'deduction_days' => $rule->deduction_days,
            'deduction_amount' => $deductionAmount,
            'status' => $status,
            'notes' => 'Demo: attendance rule sample.',
            'reviewed_by' => in_array($status, ['approved', 'dismissed'], true) ? $admin->id : null,
            'reviewed_at' => in_array($status, ['approved', 'dismissed'], true) ? now()->subDays(rand(0, 7)) : null,
        ]);
    }

    /**
     * @param  Collection<int, Subscription>  $subscriptions
     * @param  Collection<int, Member>  $members
     */
    private function seedMemberVisits(Collection $subscriptions, Collection $members, User $admin): void
    {
        $activeSubscriptionsByMember = $subscriptions
            ->whereIn('status', ['active', 'frozen'])
            ->keyBy('member_id');

        for ($day = 0; $day < 45; $day++) {
            $date = CarbonImmutable::now()->subDays($day);
            if ($day === 0) {
                $this->seedTodayMemberVisits($date, $members, $activeSubscriptionsByMember, $admin);

                continue;
            }

            $visitsToday = rand(27, 83);

            for ($i = 0; $i < $visitsToday; $i++) {
                $member = $members->random();
                $subscription = $activeSubscriptionsByMember->get($member->id);
                $isBlocked = ! $subscription && $i % 3 === 0;
                $isFlagged = ! $isBlocked && $i % 19 === 0;
                $checkIn = $date->startOfDay()->addHours(rand(6, 22))->addMinutes(rand(0, 59));
                $stillInside = false;

                MemberVisit::create([
                    'member_id' => $member->id,
                    'subscription_id' => $subscription?->id,
                    'check_in_at' => $checkIn,
                    'check_in_latitude' => self::GYM_LATITUDE + (rand(-10, 10) / 100000),
                    'check_in_longitude' => self::GYM_LONGITUDE + (rand(-10, 10) / 100000),
                    'check_in_accuracy_meters' => rand(7, 45),
                    'check_in_distance_meters' => $isFlagged ? rand(170, 450) : rand(2, 70),
                    'check_in_location_status' => $isFlagged ? 'outside' : 'inside',
                    'check_out_at' => $stillInside ? null : $checkIn->addMinutes(rand(45, 140)),
                    'check_out_latitude' => $stillInside ? null : self::GYM_LATITUDE + (rand(-10, 10) / 100000),
                    'check_out_longitude' => $stillInside ? null : self::GYM_LONGITUDE + (rand(-10, 10) / 100000),
                    'check_out_accuracy_meters' => $stillInside ? null : rand(7, 45),
                    'check_out_distance_meters' => $stillInside ? null : rand(2, 90),
                    'check_out_location_status' => $stillInside ? null : 'inside',
                    'status' => $isBlocked ? 'blocked' : ($isFlagged ? 'flagged' : 'allowed'),
                    'scan_method' => ['qr', 'phone', 'name', 'member_id'][$i % 4],
                    'alert_reason' => $isBlocked ? 'No active subscription for demo visit.' : ($isFlagged ? 'GPS outside gym radius.' : null),
                    'notes' => $stillInside ? 'Demo: currently inside gym.' : null,
                    'created_by' => $admin->id,
                ]);
            }
        }
    }

    /**
     * @param  Collection<int, Member>  $members
     * @param  Collection<int, Subscription>  $activeSubscriptionsByMember
     */
    private function seedTodayMemberVisits(
        CarbonImmutable $date,
        Collection $members,
        Collection $activeSubscriptionsByMember,
        User $admin,
    ): void {
        $now = CarbonImmutable::now();
        $insideSeeded = 0;
        $sequence = 0;
        $scanMethods = ['qr', 'phone', 'name', 'member_id', 'manual'];
        $durations = [42, 55, 68, 82, 96, 115, 132];

        $hourlyProfile = [
            0 => 4,
            1 => 5,
            2 => 4,
            3 => 5,
            4 => 6,
            5 => 7,
            6 => 4,
            7 => 7,
            8 => 6,
            9 => 3,
            10 => 2,
            11 => 3,
            12 => 4,
            13 => 5,
            14 => 6,
            15 => 7,
            16 => 8,
            17 => 10,
            18 => 12,
            19 => 11,
            20 => 8,
            21 => 5,
            22 => 2,
        ];

        foreach ($hourlyProfile as $hour => $visitsInHour) {
            $hourStart = $date->startOfDay()->addHours($hour);
            if ($hourStart->greaterThan($now)) {
                break;
            }

            for ($slot = 0; $slot < $visitsInHour; $slot++) {
                $checkIn = $hourStart->addMinutes((int) floor(($slot + 1) * (60 / ($visitsInHour + 1))));
                if ($checkIn->greaterThan($now)) {
                    continue;
                }

                $member = $members[(($sequence * 7) + $slot) % $members->count()] ?? $members->random();
                $subscription = $activeSubscriptionsByMember->get($member->id);
                $isBlocked = ! $subscription && $sequence % 5 === 0;
                $isFlagged = ! $isBlocked && in_array($sequence % 29, [0, 17], true);
                $recentEnoughToStay = $checkIn->greaterThanOrEqualTo($now->subHours(3));
                $stillInside = $recentEnoughToStay && $insideSeeded < 18 && $sequence % 2 === 0;
                $duration = $durations[$sequence % count($durations)];
                $checkOut = $stillInside ? null : $checkIn->addMinutes($duration);

                if ($stillInside) {
                    $insideSeeded++;
                } elseif ($checkOut?->greaterThan($now)) {
                    $checkOut = $now->subMinutes(5 + ($sequence % 18));
                }

                MemberVisit::create([
                    'member_id' => $member->id,
                    'subscription_id' => $subscription?->id,
                    'check_in_at' => $checkIn,
                    'check_in_latitude' => self::GYM_LATITUDE + (rand(-10, 10) / 100000),
                    'check_in_longitude' => self::GYM_LONGITUDE + (rand(-10, 10) / 100000),
                    'check_in_accuracy_meters' => rand(7, 45),
                    'check_in_distance_meters' => $isFlagged ? rand(170, 450) : rand(2, 70),
                    'check_in_location_status' => $isFlagged ? 'outside' : 'inside',
                    'check_out_at' => $checkOut,
                    'check_out_latitude' => $stillInside ? null : self::GYM_LATITUDE + (rand(-10, 10) / 100000),
                    'check_out_longitude' => $stillInside ? null : self::GYM_LONGITUDE + (rand(-10, 10) / 100000),
                    'check_out_accuracy_meters' => $stillInside ? null : rand(7, 45),
                    'check_out_distance_meters' => $stillInside ? null : rand(2, 90),
                    'check_out_location_status' => $stillInside ? null : 'inside',
                    'status' => $isBlocked ? 'blocked' : ($isFlagged ? 'flagged' : 'allowed'),
                    'scan_method' => $scanMethods[$sequence % count($scanMethods)],
                    'alert_reason' => $isBlocked ? 'No active subscription for demo visit.' : ($isFlagged ? 'GPS outside gym radius.' : null),
                    'notes' => $stillInside ? 'Demo: currently inside gym.' : null,
                    'created_by' => $admin->id,
                ]);

                $sequence++;
            }
        }
    }

    /**
     * @param  Collection<int, Employee>  $employees
     */
    private function seedPayroll(Collection $employees): void
    {
        for ($monthOffset = 11; $monthOffset >= 0; $monthOffset--) {
            $month = now()->subMonthsNoOverflow($monthOffset);

            $employees->where('status', 'active')->each(function (Employee $employee, int $index) use ($month): void {
                $monthKey = $month->format('Y-m');
                $isOpenPayroll = $month->isCurrentMonth()
                    || ($month->format('Y-m') === now()->subMonthNoOverflow()->format('Y-m') && $index % 4 === 0);
                $commissions = Commission::query()
                    ->where('employee_id', $employee->id)
                    ->where('month', $monthKey)
                    ->sum('amount');
                $attendanceDeductions = AttendanceViolation::query()
                    ->where('employee_id', $employee->id)
                    ->whereIn('status', ['approved', 'auto_applied'])
                    ->whereBetween('violation_date', [$month->copy()->startOfMonth(), $month->copy()->endOfMonth()])
                    ->sum('deduction_amount');
                $bonuses = ($index + (int) $month->format('m')) % 4 === 0 ? rand(200, 700) : 0;
                $manualDeductions = $index % 5 === 0 ? rand(100, 350) : 0;
                $netSalary = round((float) $employee->base_salary + (float) $commissions + $bonuses - $manualDeductions - (float) $attendanceDeductions, 2);

                Payroll::create([
                    'employee_id' => $employee->id,
                    'month' => $monthKey,
                    'base_salary' => $employee->base_salary,
                    'commissions_total' => $commissions,
                    'bonuses' => $bonuses,
                    'deductions' => $manualDeductions,
                    'attendance_deductions' => $attendanceDeductions,
                    'attendance_snapshot' => [
                        'present_days' => rand(19, 25),
                        'late_days' => rand(0, 5),
                        'absence_days' => rand(0, 2),
                    ],
                    'net_salary' => $netSalary,
                    'status' => $isOpenPayroll ? 'pending' : 'paid',
                    'paid_at' => $isOpenPayroll ? null : $month->copy()->endOfMonth()->subDays(rand(0, 3)),
                    'created_at' => $month->copy()->endOfMonth()->subDays(rand(0, 5)),
                    'updated_at' => $month->copy()->endOfMonth()->subDays(rand(0, 2)),
                ]);
            });
        }
    }

    private function seedExpenses(User $admin): void
    {
        $categories = [
            ['rent', 'Demo: branch rent'],
            ['utilities', 'Demo: electricity and water'],
            ['maintenance', 'Demo: equipment maintenance'],
            ['marketing', 'Demo: social ads'],
            ['cleaning', 'Demo: cleaning supplies'],
            ['software', 'Demo: systems and subscriptions'],
        ];

        for ($monthOffset = 11; $monthOffset >= 0; $monthOffset--) {
            $month = now()->subMonthsNoOverflow($monthOffset)->startOfMonth();

            foreach ($categories as $index => [$category, $description]) {
                Expense::create([
                    'category' => $category,
                    'amount' => match ($category) {
                        'rent' => rand(13000, 18000),
                        'utilities' => rand(2500, 5200),
                        'maintenance' => rand(1200, 6500),
                        'marketing' => rand(1800, 7800),
                        'cleaning' => rand(900, 2600),
                        default => rand(700, 2400),
                    },
                    'description' => $description,
                    'date' => $month->copy()->addDays(($index * 4) + rand(0, 3))->toDateString(),
                    'created_by' => $admin->id,
                ]);
            }
        }
    }

    /**
     * @param  Collection<int, Employee>  $employees
     */
    private function seedCalendarEvents(Collection $employees, User $admin): void
    {
        $templates = [
            ['Morning HIIT Class', 'class', 'Studio A', 7, 60],
            ['PT Assessment Slots', 'training', 'Assessment Desk', 10, 90],
            ['Equipment Safety Check', 'maintenance', 'Main Floor', 12, 45],
            ['Membership Renewal Calls', 'sales', 'Front Desk', 14, 120],
            ['Payroll Review', 'finance', 'Office', 16, 60],
            ['Evening Strength Class', 'class', 'Weights Area', 18, 75],
            ['Inventory Count', 'inventory', 'Store Room', 20, 60],
        ];

        for ($day = -21; $day <= 35; $day++) {
            $date = CarbonImmutable::now()->addDays($day);
            foreach ($templates as $index => [$title, $type, $location, $hour, $minutes]) {
                if (($date->day + $index) % 3 === 0) {
                    continue;
                }

                $startsAt = $date->setTime($hour, [0, 15, 30][$index % 3]);
                OperationsCalendarEvent::create([
                    'date' => $date->toDateString(),
                    'starts_at' => $startsAt,
                    'ends_at' => $startsAt->addMinutes($minutes),
                    'all_day' => false,
                    'title' => 'Demo: '.$title,
                    'type' => $type,
                    'status' => $date->isPast() ? ['done', 'delayed', 'cancelled'][$index % 3] : 'scheduled',
                    'assigned_employee_id' => $employees[$index % $employees->count()]->id,
                    'location' => $location,
                    'notes' => 'Seeded operations event for calendar demo.',
                    'created_by' => $admin->id,
                ]);
            }
        }
    }

    /**
     * @param  Collection<int, Employee>  $employees
     * @param  Collection<int, User>  $users
     */
    private function seedGymTasks(Collection $employees, Collection $users): void
    {
        $tasks = [
            ['Renew expiring VIP memberships', 'sales', 'high'],
            ['Audit low-stock supplement shelf', 'inventory', 'high'],
            ['Call members with pending balances', 'finance', 'urgent'],
            ['Repair treadmill number 4', 'maintenance', 'urgent'],
            ['Prepare Ramadan offer poster', 'marketing', 'medium'],
            ['Update evening class capacity', 'operations', 'medium'],
            ['Review late attendance warnings', 'hr', 'high'],
            ['Clean and label locker area', 'facility', 'low'],
            ['Upload new product photos', 'inventory', 'medium'],
            ['Confirm corporate plan leads', 'sales', 'high'],
            ['Print member QR cards batch 1', 'operations', 'medium'],
            ['Check payroll receipt Arabic output', 'finance', 'high'],
            ['Schedule PT follow-up calls', 'training', 'medium'],
            ['Inspect AC filters in studio', 'maintenance', 'medium'],
            ['Review blocked member visits', 'attendance', 'urgent'],
            ['Organize weekend challenge board', 'community', 'low'],
            ['Reconcile card terminal settlement', 'finance', 'high'],
            ['Create welcome checklist for new joiners', 'operations', 'medium'],
            ['Update staff shift swap list', 'hr', 'medium'],
            ['Check purchase order delays', 'inventory', 'high'],
            ['Prepare monthly transformation report', 'reports', 'medium'],
            ['Follow up frozen subscriptions', 'membership', 'high'],
            ['Test QR scanner station at reception', 'attendance', 'urgent'],
            ['Review product profit margins', 'pos', 'medium'],
        ];
        $statuses = ['ideas', 'planned', 'doing', 'review', 'done'];

        foreach ($tasks as $index => [$title, $category, $priority]) {
            $status = $statuses[$index % count($statuses)];
            $progress = match ($status) {
                'ideas' => rand(0, 10),
                'planned' => rand(10, 25),
                'doing' => rand(35, 70),
                'review' => rand(75, 95),
                default => 100,
            };

            $task = GymTask::create([
                'title' => 'Demo: '.$title,
                'description' => 'Seeded task with comments so board, list, filters, and detail drawer are easy to test.',
                'status' => $status,
                'priority' => $priority,
                'category' => $category,
                'progress' => $progress,
                'due_date' => now()->addDays(($index % 14) - 4)->toDateString(),
                'assigned_employee_id' => $employees[$index % $employees->count()]->id,
                'created_by' => $users[$index % $users->count()]->id,
            ]);

            for ($comment = 0; $comment < rand(1, 4); $comment++) {
                GymTaskComment::create([
                    'gym_task_id' => $task->id,
                    'user_id' => $users[($index + $comment) % $users->count()]->id,
                    'body' => [
                        'Demo: checked the current status and assigned next step.',
                        'Demo: waiting for confirmation from front desk.',
                        'Demo: progress updated after today shift.',
                        'Demo: admin note added for follow-up.',
                    ][$comment % 4],
                    'created_at' => now()->subHours(rand(1, 72)),
                    'updated_at' => now()->subHours(rand(1, 72)),
                ]);
            }
        }
    }

    private function seedNotifications(User $admin): void
    {
        $notifications = [
            ['Live attendance is above normal capacity', '42 members checked in today; review evening staffing.'],
            ['Low stock products need restock', 'Creatine and towels are below threshold.'],
            ['Pending attendance warnings', 'Several late check-ins need admin review.'],
            ['Payroll draft is ready', 'Current month payroll includes attendance deductions.'],
            ['Expiring memberships', 'Members due within seven days are waiting for renewal calls.'],
            ['Purchase order delayed', 'One supplier order is past expected date.'],
            ['Blocked visit recorded', 'A member attempted entry without an active subscription.'],
            ['Finance balance attention', 'Outstanding dues need collection follow-up.'],
        ];

        foreach ($notifications as $index => [$title, $body]) {
            $admin->notifications()->create([
                'id' => (string) Str::uuid(),
                'type' => 'App\\Notifications\\DashboardDemoNotification',
                'data' => compact('title', 'body'),
                'read_at' => $index < 3 ? now()->subDays(rand(1, 4)) : null,
                'created_at' => now()->subHours($index * 6),
                'updated_at' => now()->subHours($index * 6),
            ]);
        }
    }
}
