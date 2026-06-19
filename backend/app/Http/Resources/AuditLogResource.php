<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\WrapsApiResponse;
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
use App\Models\Subscription;
use App\Models\SubscriptionFreeze;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

final class AuditLogResource extends JsonResource
{
    use WrapsApiResponse;

    public static array $aliasMap = [
        'member' => Member::class,
        'subscription' => Subscription::class,
        'sale' => Sale::class,
        'payment' => Payment::class,
        'payroll' => Payroll::class,
        'commission' => Commission::class,
        'employee' => Employee::class,
        'expense' => Expense::class,
        'inventory_movement' => InventoryMovement::class,
        'product' => Product::class,
        'plan' => Plan::class,
        'subscription_freeze' => SubscriptionFreeze::class,
    ];

    public static function getAliasForType(string $type): string
    {
        $flipped = array_flip(self::$aliasMap);

        return $flipped[$type] ?? $type;
    }

    public static function getTypeForAlias(string $alias): ?string
    {
        return self::$aliasMap[$alias] ?? null;
    }

    /**
     * Transform the resource into an array.
     */
    public function toArray(Request $request): array
    {
        $subjectAlias = $this->subject_type ? self::getAliasForType($this->subject_type) : null;

        $causerType = 'user';
        if (! $this->causer) {
            $causerType = 'system';
        }

        return [
            'id' => $this->id,
            'action' => $this->event ?? $this->description,
            'description' => $this->description,
            'subject' => $this->subject_type ? [
                'type' => $subjectAlias,
                'id' => $this->subject_id,
            ] : null,
            'causer' => $this->causer ? [
                'id' => $this->causer->id,
                'name' => $this->causer->name,
            ] : null,
            'causer_type' => $causerType,
            'changes' => $this->changes ?? (object) [],
            'properties' => $this->properties ?? (object) [],
            'created_at' => $this->created_at?->toDateTimeString(),
        ];
    }
}
