<?php

namespace App\Support;

use App\Models\User;
use Carbon\CarbonImmutable;

/**
 * Keeps limited report access consistent across every report entry point.
 *
 * A user with reports.view always has normal historical access. The
 * reports.view_today permission is restrictive only when reports.view is not
 * also present, so granting both permissions never narrows an administrator.
 */
final class ReportAccess
{
    public static function canView(?User $user): bool
    {
        return $user !== null && ($user->can(PosPermissions::PERM_REPORTS_VIEW)
            || $user->can(PosPermissions::PERM_REPORTS_VIEW_TODAY));
    }

    public static function isTodayOnly(?User $user): bool
    {
        return $user !== null
            && ! $user->can(PosPermissions::PERM_REPORTS_VIEW)
            && $user->can(PosPermissions::PERM_REPORTS_VIEW_TODAY);
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public static function scopeFilters(User $user, array $filters): array
    {
        if (! self::isTodayOnly($user)) {
            return $filters;
        }

        $today = CarbonImmutable::today()->toDateString();

        return [
            ...$filters,
            'from' => $today,
            'to' => $today,
            'group_by' => 'day',
            '_today_only' => true,
        ];
    }
}
