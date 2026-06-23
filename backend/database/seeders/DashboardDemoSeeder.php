<?php

namespace Database\Seeders;

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Seed realistic demo data for the dashboard.
 *
 * This seeder is meant for local development and UI demos. It creates
 * members, subscriptions, products, sales, payments, notifications and
 * commissions so the dashboard widgets have live-looking data to display.
 */
class DashboardDemoSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $admin = User::where('email', 'admin@gym.test')->firstOrFail();
            $cashier = User::where('email', 'cashier@gym.test')->firstOrFail();
            $manager = User::where('email', 'manager@gym.test')->firstOrFail();
            $salesUsers = collect([$admin, $cashier, $manager]);

            $plans = Plan::factory()->count(5)->create();
            $members = $this->seedMembers($admin);

            $activeSubscriptions = $this->seedActiveSubscriptions($members->take(20), $plans, $salesUsers);
            $expiringSoonSubscriptions = $this->seedExpiringSoonSubscriptions($members->slice(20, 5), $plans, $salesUsers);
            $this->seedExpiredSubscriptions($members->slice(25, 5), $plans, $salesUsers);

            $this->seedSubscriptionPayments($activeSubscriptions, $expiringSoonSubscriptions, $admin);

            $products = Product::factory()->count(15)->create();
            Product::factory()->count(5)->lowStock()->create();

            $sales = $this->seedSales($members, $salesUsers, $products, $admin);

            $this->seedCommissions($sales, $cashier);
            $this->seedNotifications($admin);
        });
    }

    /**
     * @return Collection<int, Member>
     */
    private function seedMembers(User $admin)
    {
        $members = collect();

        for ($i = 0; $i < 30; $i++) {
            $members->push(Member::create([
                'name' => "Demo Member {$i}",
                'phone' => '+2015'.str_pad((string) (100000000 + $i), 9, '0', STR_PAD_LEFT),
                'email' => "demo.member{$i}@gym.test",
                'gender' => ['male', 'female', null][array_rand(['male', 'female', null])],
                'photo_path' => null,
                'national_id' => str_pad((string) (30000000000000 + $i), 14, '0', STR_PAD_LEFT),
                'join_date' => now()->subDays(rand(1, 60))->toDateString(),
                'status' => 'active',
                'notes' => null,
                'created_by' => $admin->id,
            ]));
        }

        return $members;
    }

    /**
     * @param  Collection<int, Member>  $members
     * @param  Collection<int, Plan>  $plans
     * @param  Collection<int, User>  $salesUsers
     * @return Collection<int, Subscription>
     */
    private function seedActiveSubscriptions($members, $plans, $salesUsers)
    {
        return $members->map(function (Member $member) use ($plans, $salesUsers) {
            $plan = $plans->random();
            $start = now()->subDays(rand(1, 20));

            return Subscription::create([
                'member_id' => $member->id,
                'plan_id' => $plan->id,
                'start_date' => $start->toDateString(),
                'end_date' => $start->copy()->addDays($plan->duration_days)->toDateString(),
                'status' => 'active',
                'price_paid' => $plan->price,
                'discount' => 0.00,
                'sold_by_user_id' => $salesUsers->random()->id,
                'created_by' => $salesUsers->random()->id,
                'last_reminded_on' => null,
            ]);
        });
    }

    /**
     * @param  Collection<int, Member>  $members
     * @param  Collection<int, Plan>  $plans
     * @param  Collection<int, User>  $salesUsers
     * @return Collection<int, Subscription>
     */
    private function seedExpiringSoonSubscriptions($members, $plans, $salesUsers)
    {
        return $members->map(function (Member $member) use ($plans, $salesUsers) {
            $plan = $plans->random();
            $end = now()->addDays(rand(1, 6));

            return Subscription::create([
                'member_id' => $member->id,
                'plan_id' => $plan->id,
                'start_date' => $end->copy()->subDays($plan->duration_days)->toDateString(),
                'end_date' => $end->toDateString(),
                'status' => 'active',
                'price_paid' => $plan->price,
                'discount' => 0.00,
                'sold_by_user_id' => $salesUsers->random()->id,
                'created_by' => $salesUsers->random()->id,
                'last_reminded_on' => null,
            ]);
        });
    }

    /**
     * @param  Collection<int, Member>  $members
     * @param  Collection<int, Plan>  $plans
     * @param  Collection<int, User>  $salesUsers
     */
    private function seedExpiredSubscriptions($members, $plans, $salesUsers): void
    {
        $members->each(function (Member $member) use ($plans, $salesUsers) {
            $plan = $plans->random();
            $end = now()->subDays(rand(1, 10));

            Subscription::create([
                'member_id' => $member->id,
                'plan_id' => $plan->id,
                'start_date' => $end->copy()->subDays($plan->duration_days)->toDateString(),
                'end_date' => $end->toDateString(),
                'status' => 'expired',
                'price_paid' => $plan->price,
                'discount' => 0.00,
                'sold_by_user_id' => $salesUsers->random()->id,
                'created_by' => $salesUsers->random()->id,
                'last_reminded_on' => null,
            ]);
        });
    }

    /**
     * @param  Collection<int, Subscription>  $active
     * @param  Collection<int, Subscription>  $expiringSoon
     */
    private function seedSubscriptionPayments($active, $expiringSoon, User $admin): void
    {
        $active->merge($expiringSoon)->each(function (Subscription $subscription) use ($admin) {
            Payment::create([
                'payable_type' => Subscription::class,
                'payable_id' => $subscription->id,
                'amount' => $subscription->price_paid,
                'method' => ['cash', 'card', 'bank_transfer'][array_rand(['cash', 'card', 'bank_transfer'])],
                'status' => 'paid',
                'paid_at' => now()->subDays(rand(0, 29))->startOfDay()->addHours(rand(8, 22))->addMinutes(rand(0, 59)),
                'due_date' => null,
                'created_by' => $admin->id,
            ]);
        });
    }

    /**
     * @param  Collection<int, Member>  $members
     * @param  Collection<int, User>  $salesUsers
     * @param  Collection<int, Product>  $products
     * @return Collection<int, Sale>
     */
    private function seedSales($members, $salesUsers, $products, User $admin)
    {
        $sales = collect();

        for ($i = 0; $i < 50; $i++) {
            $member = $members->random();
            $user = $salesUsers->random();
            $daysAgo = $i < 5 ? 0 : rand(1, 29);
            $saleDate = now()
                ->subDays($daysAgo)
                ->startOfDay()
                ->addHours(rand(8, 22))
                ->addMinutes(rand(0, 59));

            $product = $products->random();
            $quantity = rand(1, 3);
            $unitPrice = $product->price;
            $total = round($quantity * $unitPrice, 2);
            $paymentMethod = ['cash', 'card', 'bank_transfer'][array_rand(['cash', 'card', 'bank_transfer'])];

            $sale = Sale::create([
                'idempotency_key' => (string) Str::uuid(),
                'member_id' => $member->id,
                'sold_by_user_id' => $user->id,
                'subtotal' => $total,
                'discount' => 0.00,
                'total' => $total,
                'payment_method' => $paymentMethod,
                'status' => 'completed',
                'notes' => null,
            ]);

            $sale->created_at = $saleDate;
            $sale->updated_at = $saleDate;
            $sale->save();

            SaleItem::create([
                'sale_id' => $sale->id,
                'product_id' => $product->id,
                'quantity' => $quantity,
                'unit_price' => $unitPrice,
                'total' => $total,
            ]);

            Payment::create([
                'payable_type' => Sale::class,
                'payable_id' => $sale->id,
                'amount' => $total,
                'method' => $paymentMethod,
                'status' => 'paid',
                'paid_at' => $saleDate,
                'due_date' => null,
                'created_by' => $admin->id,
            ]);

            $sales->push($sale);
        }

        return $sales;
    }

    /**
     * @param  Collection<int, Sale>  $sales
     */
    private function seedCommissions($sales, User $cashier): void
    {
        $employee = Employee::factory()->captain()->create([
            'user_id' => $cashier->id,
            'name' => $cashier->name,
        ]);

        $sales->take(10)->each(function (Sale $sale) use ($employee) {
            Commission::create([
                'employee_id' => $employee->id,
                'source_type' => Sale::class,
                'source_id' => $sale->id,
                'rate' => 0.1000,
                'amount' => round($sale->total * 0.10, 2),
                'month' => now()->format('Y-m'),
                'status' => 'pending',
            ]);
        });
    }

    private function seedNotifications(User $admin): void
    {
        for ($i = 0; $i < 5; $i++) {
            $admin->notifications()->create([
                'id' => (string) Str::uuid(),
                'type' => 'App\\Notifications\\DashboardDemoNotification',
                'data' => [
                    'title' => 'Dashboard demo notification',
                    'body' => 'This is a seeded notification for the dashboard preview.',
                ],
                'read_at' => $i < 2 ? now() : null,
            ]);
        }
    }
}
