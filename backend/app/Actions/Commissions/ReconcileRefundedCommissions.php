<?php

namespace App\Actions\Commissions;

use App\Actions\Payroll\GeneratePayroll;
use App\Models\Payment;
use App\Models\Payroll;
use App\Models\Subscription;
use App\Models\SubscriptionAddon;
use App\Models\SubscriptionRefund;
use Illuminate\Support\Facades\DB;

final class ReconcileRefundedCommissions
{
    public function __construct(
        private readonly ReverseRefundedCommissions $reverseCommissions,
        private readonly GeneratePayroll $generatePayroll,
    ) {}

    /**
     * Create missing commission reversals for refunds recorded before automatic
     * reversal support was introduced.
     *
     * @return array{subscription_refunds: int, addon_refunds: int, reversals_created: int, payrolls_refreshed: int}
     */
    public function execute(bool $dryRun = false): array
    {
        DB::beginTransaction();

        try {
            $results = $this->reconcile();

            if ($dryRun) {
                DB::rollBack();
            } else {
                DB::commit();
            }

            return $results;
        } catch (\Throwable $exception) {
            DB::rollBack();

            throw $exception;
        }
    }

    /**
     * @return array{subscription_refunds: int, addon_refunds: int, reversals_created: int, payrolls_refreshed: int}
     */
    private function reconcile(): array
    {
        $subscriptionRefunds = 0;
        $addonRefunds = 0;
        $reversalsCreated = 0;

        $packageRefunds = SubscriptionRefund::query()
            ->selectRaw('subscription_id, SUM(amount) as refund_total')
            ->groupBy('subscription_id')
            ->get();

        foreach ($packageRefunds as $refund) {
            $subscription = Subscription::query()
                ->with(['payments', 'addons.payments'])
                ->find($refund->subscription_id);

            if ($subscription === null) {
                continue;
            }

            $subscriptionRefunds++;
            $reversalsCreated += $this->reverseCommissions->handle(
                collect([$subscription])->concat($subscription->addons),
                bcadd((string) $refund->refund_total, '0.00', 2),
                $this->subscriptionPaidTotal($subscription),
            );
        }

        $addonRefundPayments = Payment::query()
            ->where('payable_type', SubscriptionAddon::class)
            ->where('status', Payment::STATUS_REFUNDED)
            ->where('amount', '<', 0)
            ->selectRaw('payable_id, SUM(ABS(amount)) as refund_total')
            ->groupBy('payable_id')
            ->get();

        foreach ($addonRefundPayments as $refund) {
            $addon = SubscriptionAddon::query()->with('payments')->find($refund->payable_id);

            if ($addon === null) {
                continue;
            }

            $addonRefunds++;
            $reversalsCreated += $this->reverseCommissions->handle(
                [$addon],
                bcadd((string) $refund->refund_total, '0.00', 2),
                $this->addonPaidTotal($addon),
            );
        }

        $payrollsRefreshed = 0;

        if ($reversalsCreated > 0) {
            Payroll::query()
                ->where('status', 'pending')
                ->with('employee')
                ->each(function (Payroll $payroll) use (&$payrollsRefreshed): void {
                    $this->generatePayroll->refreshPendingPayroll($payroll, $payroll->employee);
                    $payrollsRefreshed++;
                });
        }

        return [
            'subscription_refunds' => $subscriptionRefunds,
            'addon_refunds' => $addonRefunds,
            'reversals_created' => $reversalsCreated,
            'payrolls_refreshed' => $payrollsRefreshed,
        ];
    }

    private function subscriptionPaidTotal(Subscription $subscription): string
    {
        $mainPaid = $subscription->payments
            ->filter(fn (Payment $payment): bool => in_array($payment->status, Payment::COLLECTED_STATUSES, true))
            ->reduce(
                fn (string $carry, Payment $payment): string => bcadd($carry, (string) $payment->amount, 2),
                '0.00',
            );

        if (bccomp($mainPaid, '0.00', 2) === 0 && $subscription->price_paid) {
            $mainPaid = bcadd((string) $subscription->price_paid, '0.00', 2);
        }

        $addonsPaid = $subscription->addons->reduce(
            fn (string $carry, SubscriptionAddon $addon): string => bcadd($carry, $this->addonPaidTotal($addon), 2),
            '0.00',
        );

        return bcadd($mainPaid, $addonsPaid, 2);
    }

    private function addonPaidTotal(SubscriptionAddon $addon): string
    {
        $paid = $addon->payments
            ->filter(fn (Payment $payment): bool => in_array($payment->status, Payment::COLLECTED_STATUSES, true))
            ->reduce(
                fn (string $carry, Payment $payment): string => bcadd($carry, (string) $payment->amount, 2),
                '0.00',
            );

        if (bccomp($paid, '0.00', 2) === 0 && $addon->price_paid) {
            return bcadd((string) $addon->price_paid, '0.00', 2);
        }

        return $paid;
    }
}
