<?php

namespace App\Support;

use App\Models\Setting;
use Illuminate\Support\Carbon;

/**
 * The gym's working day, which is not the calendar day.
 *
 * The desk keeps trading past midnight, so the shift that finishes the night
 * belongs to the day it started — the day everyone at the gym is still calling
 * "today". Deriving that from the calendar put the boundary in the middle of the
 * night shift instead: the drawer reset to zero at 00:00 with the evening's cash
 * still in it, and the next morning's shift then counted as "same day" and
 * opened holding takings that should already have been banked.
 *
 * So the day turns over at an hour when nobody is at the desk — 05:00 gym time
 * by default, and changeable from Settings for a gym that closes later.
 */
final class BusinessDay
{
    public const SETTING_KEY = 'shifts.day_starts_at_hour';

    public const DEFAULT_START_HOUR = 5;

    public const CLOSED_GAP_SETTING_KEY = 'shifts.reset_after_closed_hours';

    /**
     * How long the desk must sit closed before the next shift counts as a new
     * day's trading. Four hours clears the gym's overnight break (last shift
     * ends 03:00, first opens 09:00) without touching a handover between two
     * shifts, which is minutes apart.
     */
    public const DEFAULT_CLOSED_GAP_HOURS = 4;

    /** The business date a moment falls in, as YYYY-MM-DD. */
    public static function at(?Carbon $moment = null): string
    {
        $moment = ($moment ?? Carbon::now())->copy()->setTimezone(config('app.timezone'));

        return $moment->hour < self::startHour()
            ? $moment->subDay()->toDateString()
            : $moment->toDateString();
    }

    /**
     * The business day before the one a moment falls in — "the day that just
     * ended" for anything reporting on a finished day.
     */
    public static function previous(?Carbon $moment = null): string
    {
        return Carbon::parse(self::at($moment))->subDay()->toDateString();
    }

    /**
     * The wall-clock span a business date covers: its start hour through to the
     * same hour the next morning.
     *
     * Anything reporting on a day has to read this rather than 00:00–23:59, or
     * it cuts the night shift in half and files its takings under tomorrow.
     *
     * @return array{0: Carbon, 1: Carbon} start (inclusive) and end (exclusive)
     */
    public static function windowFor(Carbon|string $date): array
    {
        $start = ($date instanceof Carbon ? $date->copy() : Carbon::parse($date))
            ->startOfDay()
            ->addHours(self::startHour());

        return [$start, $start->copy()->addDay()];
    }

    /**
     * Whether the desk has been shut long enough that the day's trading is over.
     *
     * This is the reset the gym actually recognises: the last shift ended, the
     * money was banked, and the place was empty until somebody opened up again.
     * It answers on the shift's own lifecycle rather than on a clock, so no hour
     * passing can empty a drawer that is still being worked.
     */
    public static function closedLongEnough(?Carbon $closedAt, ?Carbon $now = null): bool
    {
        if (! $closedAt) {
            return false;
        }

        $now ??= Carbon::now();

        return $closedAt->copy()->addHours(self::closedGapHours())->lessThanOrEqualTo($now);
    }

    /** Hours of closure that end the trading day. Nonsense values fall back to the default. */
    public static function closedGapHours(): int
    {
        $value = self::setting(self::CLOSED_GAP_SETTING_KEY);

        if (! is_numeric($value)) {
            return self::DEFAULT_CLOSED_GAP_HOURS;
        }

        $hours = (int) $value;

        // Under an hour would fire between two shifts handing over; past a day it
        // could never fire at all.
        return $hours >= 1 && $hours <= 24 ? $hours : self::DEFAULT_CLOSED_GAP_HOURS;
    }

    /**
     * The hour the working day starts, 0–23.
     *
     * A value outside that range falls back to the default: quietly shifting
     * every day's boundary is worse than ignoring one bad settings row.
     */
    public static function startHour(): int
    {
        $value = self::setting(self::SETTING_KEY);

        if (! is_numeric($value)) {
            return self::DEFAULT_START_HOUR;
        }

        $hour = (int) $value;

        return $hour >= 0 && $hour <= 23 ? $hour : self::DEFAULT_START_HOUR;
    }

    private static function setting(string $key): mixed
    {
        $value = Setting::query()->where('key', $key)->value('value');

        return is_array($value) && array_key_exists('value', $value) ? $value['value'] : $value;
    }
}
