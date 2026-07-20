<?php

namespace App\Observers;

use App\Jobs\CalculateCommissionJob;
use App\Models\Sale;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class SaleObserver
{
    public function created(Sale $sale): void
    {
        DB::afterCommit(function () use ($sale) {
            CalculateCommissionJob::dispatch(Sale::class, $sale->id);
            Cache::forget('dashboard:summary:v1');
            Cache::forget('dashboard:summary:v2');
            Cache::forget('dashboard:summary:v3');
        });
    }

    public function updated(Sale $sale): void
    {
        DB::afterCommit(function () {
            Cache::forget('dashboard:summary:v1');
            Cache::forget('dashboard:summary:v2');
            Cache::forget('dashboard:summary:v3');
        });
    }

    public function deleted(Sale $sale): void
    {
        DB::afterCommit(function () {
            Cache::forget('dashboard:summary:v1');
            Cache::forget('dashboard:summary:v2');
            Cache::forget('dashboard:summary:v3');
        });
    }
}
