<?php

namespace App\Providers;

use App\Models\Sale;
use App\Models\Subscription;
use App\Observers\SaleObserver;
use App\Observers\SubscriptionObserver;
use App\Policies\AuditLogPolicy;
use App\Policies\RolePolicy;
use App\Support\SystemPermissions;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Spatie\Activitylog\Models\Activity;
use Spatie\Permission\Models\Role;

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

        Gate::policy(Role::class, RolePolicy::class);
        Gate::policy(Activity::class, AuditLogPolicy::class);

        Gate::define('download-export', function ($user) {
            return true;
        });

        Gate::define('export-resource', function ($user, string $resource) {
            $validResources = array_keys(SystemPermissions::EXPORT_PERMISSION_MAP);
            if (! in_array($resource, $validResources, true)) {
                return true; // Let Controller validate and return 422
            }
            $permission = SystemPermissions::EXPORT_PERMISSION_MAP[$resource];

            return $user->can($permission);
        });
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

        RateLimiter::for('export', function (Request $request): Limit {
            return Limit::perMinute(5)->by(
                optional($request->user())->id ?: $request->ip(),
            );
        });
    }
}
