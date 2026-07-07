<?php

namespace App\Observers;

use App\Models\Payment;
use Illuminate\Support\Facades\Cache;

class PaymentObserver
{
    public function created(Payment $payment): void
    {
        Cache::forget('dashboard:summary:v1');
        Cache::forget('dashboard:summary:v2');
    }

    public function updated(Payment $payment): void
    {
        Cache::forget('dashboard:summary:v1');
        Cache::forget('dashboard:summary:v2');
    }

    public function deleted(Payment $payment): void
    {
        Cache::forget('dashboard:summary:v1');
        Cache::forget('dashboard:summary:v2');
    }
}
