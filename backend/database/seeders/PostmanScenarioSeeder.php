<?php

namespace Database\Seeders;

use App\Models\Commission;
use App\Models\Employee;
use App\Models\Expense;
use App\Models\InventoryMovement;
use App\Models\Member;
use App\Models\Payment;
use App\Models\Payroll;
use App\Models\Plan;
use App\Models\Product;
use App\Models\Sale;
use App\Models\SaleItem;
use App\Models\Setting;
use App\Models\Subscription;
use App\Models\SubscriptionFreeze;
use App\Models\User;
use App\Notifications\SubscriptionRenewalReminder;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Role;

class PostmanScenarioSeeder extends Seeder
{
    public function run(): void
    {
        DB::transaction(function (): void {
            $admin = User::where('email', 'admin@gym.test')->firstOrFail();
            $manager = User::where('email', 'manager@gym.test')->firstOrFail();
            $cashier = User::where('email', 'cashier@gym.test')->firstOrFail();
            $captain = User::where('email', 'captain@gym.test')->firstOrFail();
            $accountant = User::where('email', 'accountant@gym.test')->firstOrFail();

            $member = Member::updateOrCreate(
                ['email' => 'postman.member@gym.test'],
                [
                    'name' => 'Postman Member',
                    'phone' => '+201234567890',
                    'gender' => 'female',
                    'national_id' => '29504120102030',
                    'join_date' => '2026-06-10',
                    'status' => 'active',
                    'notes' => 'Primary seeded member for Postman flows.',
                    'created_by' => $admin->id,
                ],
            );

            $crudMember = Member::updateOrCreate(
                ['email' => 'postman.member.crud@gym.test'],
                [
                    'name' => 'Postman CRUD Member',
                    'phone' => '+201234567891',
                    'gender' => 'male',
                    'national_id' => '29308200102031',
                    'join_date' => '2026-06-11',
                    'status' => 'active',
                    'notes' => 'Separate seeded member for member CRUD/deactivate requests.',
                    'created_by' => $admin->id,
                ],
            );

            $plan = Plan::updateOrCreate(
                ['name' => 'Postman Standard Monthly'],
                [
                    'description' => 'Stable plan used by Postman scenarios.',
                    'price' => 300.00,
                    'commission_rate' => 0.1000,
                    'duration_days' => 30,
                    'sessions_count' => null,
                    'type' => 'membership',
                    'is_active' => true,
                    'valid_from' => '2026-06-01',
                    'valid_to' => '2026-12-31',
                    'max_freeze_days' => 7,
                ],
            );

            $secondaryPlan = Plan::updateOrCreate(
                ['name' => 'Postman Premium Monthly'],
                [
                    'description' => 'Secondary plan for list/report coverage.',
                    'price' => 450.00,
                    'commission_rate' => 0.1200,
                    'duration_days' => 30,
                    'sessions_count' => null,
                    'type' => 'membership',
                    'is_active' => true,
                    'valid_from' => '2026-06-01',
                    'valid_to' => '2026-12-31',
                    'max_freeze_days' => 10,
                ],
            );

            $subscription = Subscription::updateOrCreate(
                ['member_id' => $member->id, 'plan_id' => $plan->id, 'start_date' => '2026-06-10'],
                [
                    'end_date' => '2026-07-10',
                    'status' => 'active',
                    'price_paid' => 150.00,
                    'discount' => 0.00,
                    'sold_by_user_id' => $cashier->id,
                    'created_by' => $cashier->id,
                    'last_reminded_on' => null,
                ],
            );

            Subscription::updateOrCreate(
                ['member_id' => $member->id, 'plan_id' => $secondaryPlan->id, 'start_date' => '2026-05-15'],
                [
                    'end_date' => '2026-06-18',
                    'status' => 'active',
                    'price_paid' => 450.00,
                    'discount' => 0.00,
                    'sold_by_user_id' => $manager->id,
                    'created_by' => $manager->id,
                    'last_reminded_on' => null,
                ],
            );

            Payment::updateOrCreate(
                [
                    'payable_type' => Subscription::class,
                    'payable_id' => $subscription->id,
                    'amount' => 150.00,
                ],
                [
                    'method' => 'cash',
                    'status' => 'partial',
                    'paid_at' => '2026-06-10 10:00:00',
                    'due_date' => '2026-06-20',
                    'created_by' => $cashier->id,
                ],
            );

            Payment::updateOrCreate(
                [
                    'payable_type' => Subscription::class,
                    'payable_id' => $subscription->id,
                    'amount' => 50.00,
                ],
                [
                    'method' => 'cash',
                    'status' => 'due',
                    'paid_at' => null,
                    'due_date' => '2026-06-25',
                    'created_by' => $cashier->id,
                ],
            );

            SubscriptionFreeze::updateOrCreate(
                [
                    'subscription_id' => $subscription->id,
                    'freeze_start' => '2026-06-20',
                    'freeze_end' => '2026-06-22',
                ],
                [
                    'days' => 3,
                    'reason' => 'Seeded freeze record for testing.',
                    'created_by' => $cashier->id,
                ],
            );

            $product = Product::updateOrCreate(
                ['sku' => 'POSTMAN-WHEY-1KG'],
                [
                    'name' => 'Postman Whey Protein 1kg',
                    'category' => 'supplements',
                    'price' => 850.00,
                    'cost' => 500.00,
                    'stock_quantity' => 40,
                    'low_stock_threshold' => 5,
                    'image' => 'seeded/postman-product.jpg',
                    'is_active' => true,
                ],
            );

            $lowStockProduct = Product::updateOrCreate(
                ['sku' => 'POSTMAN-WATER'],
                [
                    'name' => 'Postman Water Bottle',
                    'category' => 'drinks',
                    'price' => 25.00,
                    'cost' => 10.00,
                    'stock_quantity' => 2,
                    'low_stock_threshold' => 5,
                    'image' => null,
                    'is_active' => true,
                ],
            );

            InventoryMovement::updateOrCreate(
                [
                    'product_id' => $product->id,
                    'type' => 'in',
                    'reason' => 'Seeded opening stock',
                ],
                [
                    'quantity' => 40,
                    'created_by' => $manager->id,
                ],
            );

            $sale = Sale::updateOrCreate(
                ['idempotency_key' => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'],
                [
                    'member_id' => $member->id,
                    'sold_by_user_id' => $cashier->id,
                    'subtotal' => 850.00,
                    'discount' => 0.00,
                    'total' => 850.00,
                    'payment_method' => 'cash',
                    'status' => 'completed',
                    'notes' => 'Seeded sale for Postman receipts and reports.',
                    'created_at' => '2026-06-11 12:00:00',
                    'updated_at' => '2026-06-11 12:00:00',
                ],
            );

            SaleItem::updateOrCreate(
                [
                    'sale_id' => $sale->id,
                    'product_id' => $product->id,
                ],
                [
                    'quantity' => 1,
                    'unit_price' => 850.00,
                    'total' => 850.00,
                ],
            );

            $sale->payment()->updateOrCreate(
                ['amount' => 850.00],
                [
                    'method' => 'cash',
                    'status' => 'paid',
                    'paid_at' => '2026-06-11 12:00:00',
                    'due_date' => null,
                    'created_by' => $cashier->id,
                ],
            );

            $captainEmployee = Employee::updateOrCreate(
                ['user_id' => $captain->id],
                [
                    'name' => 'Captain Seed',
                    'phone' => '+201000000010',
                    'role' => 'captain',
                    'base_salary' => 4000.00,
                    'commission_rate' => 0.1000,
                    'hire_date' => '2026-06-01',
                    'status' => 'active',
                ],
            );

            Employee::updateOrCreate(
                ['user_id' => $manager->id],
                [
                    'name' => 'Manager Seed',
                    'phone' => '+201000000011',
                    'role' => 'manager',
                    'base_salary' => 6000.00,
                    'commission_rate' => 0.0000,
                    'hire_date' => '2026-05-01',
                    'status' => 'active',
                ],
            );

            Employee::updateOrCreate(
                ['name' => 'Seeded Employee'],
                [
                    'user_id' => null,
                    'phone' => '+201000000012',
                    'role' => 'employee',
                    'base_salary' => 3000.00,
                    'commission_rate' => 0.0500,
                    'hire_date' => '2026-04-01',
                    'status' => 'active',
                ],
            );

            Commission::updateOrCreate(
                [
                    'employee_id' => $captainEmployee->id,
                    'source_type' => Sale::class,
                    'source_id' => $sale->id,
                ],
                [
                    'rate' => 0.1000,
                    'amount' => 85.00,
                    'month' => '2026-06',
                    'status' => 'pending',
                ],
            );

            $payroll = Payroll::updateOrCreate(
                [
                    'employee_id' => $captainEmployee->id,
                    'month' => '2026-06',
                ],
                [
                    'base_salary' => 4000.00,
                    'commissions_total' => 85.00,
                    'bonuses' => 0.00,
                    'deductions' => 0.00,
                    'net_salary' => 4085.00,
                    'status' => 'pending',
                    'paid_at' => null,
                ],
            );

            $expense = Expense::updateOrCreate(
                [
                    'category' => 'rent',
                    'date' => '2026-06-10',
                ],
                [
                    'amount' => 12000.00,
                    'description' => 'Seeded monthly rent expense.',
                    'created_by' => $accountant->id,
                ],
            );

            Setting::updateOrCreate(
                ['key' => 'gym'],
                [
                    'value' => [
                        'name' => 'ATP Gym',
                        'colors' => [
                            'primary' => '#111827',
                            'secondary' => '#f59e0b',
                            'accent' => '#10b981',
                        ],
                    ],
                ],
            );

            Setting::updateOrCreate(['key' => 'currency'], ['value' => 'EGP']);
            Setting::updateOrCreate(['key' => 'vat_rate'], ['value' => 14]);
            Setting::updateOrCreate(['key' => 'reminder_days'], ['value' => 7]);

            $customRole = Role::updateOrCreate(
                ['name' => 'Front Desk Lead', 'guard_name' => 'web'],
                [],
            );
            $customRole->syncPermissions(['members.view', 'sales.view']);

            $admin->notify(new SubscriptionRenewalReminder([
                'subscription_id' => $subscription->id,
                'member_name' => $member->name,
                'end_date' => '2026-06-18',
            ]));

            $notification = $admin->notifications()->latest()->first();

            $exportId = 'seeded-export-id';
            Cache::put("export:{$exportId}", [
                'id' => $exportId,
                'status' => 'completed',
                'resource' => 'members',
                'format' => 'csv',
                'filename' => 'exports/seeded-members-export.csv',
                'user_id' => $admin->id,
            ], now()->addDay());

            Storage::disk(config('export.disk', 'local'))->put(
                'exports/seeded-members-export.csv',
                "id,name,email\n{$member->id},{$member->name},{$member->email}\n",
            );

            $this->updatePostmanEnvironment([
                'member_id' => (string) $member->id,
                'member_crud_id' => (string) $crudMember->id,
                'plan_id' => (string) $plan->id,
                'subscription_id' => (string) $subscription->id,
                'product_id' => (string) $product->id,
                'sale_id' => (string) $sale->id,
                'notification_id' => (string) $notification->id,
                'user_id' => (string) $cashier->id,
                'employee_id' => (string) $captainEmployee->id,
                'expense_id' => (string) $expense->id,
                'payroll_id' => (string) $payroll->id,
                'role_id' => (string) $customRole->id,
                'export_id' => $exportId,
            ]);
        });
    }

    /**
     * @param  array<string, string>  $replacements
     */
    private function updatePostmanEnvironment(array $replacements): void
    {
        $path = database_path('../postman_collections/Gym-project.postman_environment.json');

        if (! file_exists($path)) {
            return;
        }

        $json = json_decode(file_get_contents($path), true);

        if (! is_array($json) || ! isset($json['values']) || ! is_array($json['values'])) {
            return;
        }

        foreach ($json['values'] as &$value) {
            if (! isset($value['key']) || ! array_key_exists($value['key'], $replacements)) {
                continue;
            }

            $value['value'] = $replacements[$value['key']];
        }

        file_put_contents($path, json_encode($json, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES).PHP_EOL);
    }
}
