<?php

namespace App\Providers;

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
    }

    /**
     * Define the application's rate limiters.
     *
     * "auth"  — tight limit on login/sensitive auth endpoints to mitigate
     *           brute-force attacks. 10 attempts per minute per IP.
     *
     * "api"   — general API limit. 60 requests per minute per authenticated
     *           user or IP.
     */
    private function configureRateLimiters(): void
    {
        RateLimiter::for('auth', function (Request $request): Limit {
            return Limit::perMinute(10)->by($request->ip());
        });

        RateLimiter::for('api', function (Request $request): Limit {
            return Limit::perMinute(60)->by(
                optional($request->user())->id ?: $request->ip(),
            );
        });
    }
}
