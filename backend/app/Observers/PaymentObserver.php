<?php

namespace App\Observers;

use App\Models\Payment;
use Illuminate\Support\Facades\Cache;

class PaymentObserver
{
    public function created(Payment $payment): void
    {
        $this->forgetDashboardSummary();
    }

    public function updated(Payment $payment): void
    {
        $this->forgetDashboardSummary();
    }

    public function deleted(Payment $payment): void
    {
        $this->forgetDashboardSummary();
    }

    private function forgetDashboardSummary(): void
    {
        Cache::forget('dashboard:summary:v1');
        Cache::forget('dashboard:summary:v2');
            Cache::forget('dashboard:summary:v3');
        Cache::forget('dashboard:summary:v3');
    }
}
