<?php

namespace App\Providers;

use App\Models\Payment;
use App\Models\Sale;
use App\Models\Subscription;
use App\Observers\PaymentObserver;
use App\Observers\SaleObserver;
use App\Observers\SubscriptionObserver;
use App\Policies\AuditLogPolicy;
use App\Policies\RolePolicy;
use App\Support\SystemPermissions;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
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
        Payment::observe(PaymentObserver::class);

        Gate::policy(Role::class, RolePolicy::class);
        Gate::policy(Activity::class, AuditLogPolicy::class);

        Gate::define('change-own-password', fn ($user): bool => $user !== null);

        // Ownership check for signed export download/status routes.
        // The signed URL already limits forgery; this gate ensures only the
        // requesting user can download their own export (FR-019/V).
        Gate::define('download-export', function ($user, string $exportId) {
            $metadata = Cache::get("export:{$exportId}");

            return $metadata !== null && $metadata['user_id'] === $user->id;
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
     * "auth"      — login/sensitive auth endpoints. Kept lower than the
     *               dashboard API, but high enough for local/internal use.
     *
     * "sensitive" — tight limit on write-heavy / financial operations
     *               (commission backfill, payroll generation, payroll payout)
     *               that are expensive or money-moving and must not be hammered.
     *               300 requests per minute per authenticated user or IP.
     *
     * "api"       — general API limit. 1000 requests per minute per authenticated
     *               user or IP.
     */
    private function configureRateLimiters(): void
    {
        RateLimiter::for('auth', function (Request $request): Limit {
            return Limit::perMinute(60)->by($request->ip());
        });

        RateLimiter::for('sensitive', function (Request $request): Limit {
            return Limit::perMinute(300)->by(
                optional($request->user())->id ?: $request->ip(),
            );
        });

        RateLimiter::for('api', function (Request $request): Limit {
            return Limit::perMinute(1000)->by(
                optional($request->user())->id ?: $request->ip(),
            );
        });

        RateLimiter::for('otp-send', function (Request $request): Limit {
            $email = $request->input('email', 'unknown');

            return Limit::perMinute(20)->by('otp-send:'.$email);
        });

        RateLimiter::for('export', function (Request $request): Limit {
            return Limit::perMinute(120)->by(
                optional($request->user())->id ?: $request->ip(),
            );
        });
    }
}
