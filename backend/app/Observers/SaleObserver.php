<?php

namespace App\Observers;

use App\Actions\Commissions\CalculateCommission;
use App\Models\Sale;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SaleObserver
{
    public function created(Sale $sale): void
    {
        DB::afterCommit(function () use ($sale) {
            app(CalculateCommission::class)->forSource($sale);
            Cache::forget('dashboard:summary:v1');
        });
    }

    public function updated(Sale $sale): void
    {
        DB::afterCommit(function () {
            Cache::forget('dashboard:summary:v1');
        });
    }

    public function deleted(Sale $sale): void
    {
        DB::afterCommit(function () {
            Cache::forget('dashboard:summary:v1');
        });
    }
}
