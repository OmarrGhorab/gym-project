<?php

namespace App\Providers;

use App\Models\Sale;
use App\Models\Subscription;
use App\Observers\SaleObserver;
use App\Observers\SubscriptionObserver;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimiters();

        Subscription::observe(SubscriptionObserver::class);
        Sale::observe(SaleObserver::class);
    }

    /**
     * Define the application's rate limiters.
     *
     * "auth"      — tight limit on login/sensitive auth endpoints to mitigate
     *               brute-force attacks. 10 attempts per minute per IP.
     *
     * "sensitive" — tight limit on write-heavy / financial operations
     *               (commission backfill, payroll generation, payroll payout)
     *               that are expensive or money-moving and must not be hammered.
     *               10 requests per minute per authenticated user or IP.
     *
     * "api"       — general API limit. 60 requests per minute per authenticated
     *               user or IP.
     */
    private function configureRateLimiters(): void
    {
        RateLimiter::for('auth', function (Request $request): Limit {
            return Limit::perMinute(10)->by($request->ip());
        });

        RateLimiter::for('sensitive', function (Request $request): Limit {
            return Limit::perMinute(10)->by(
                optional($request->user())->id ?: $request->ip(),
            );
        });

        RateLimiter::for('api', function (Request $request): Limit {
            return Limit::perMinute(60)->by(
                optional($request->user())->id ?: $request->ip(),
            );
        });
    }
}
