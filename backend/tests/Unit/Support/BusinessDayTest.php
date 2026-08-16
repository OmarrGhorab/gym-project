<?php

use App\Models\Setting;
use App\Support\BusinessDay;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;

uses(RefreshDatabase::class);

afterEach(function (): void {
    Carbon::setTestNow();
});

test('the working day starts at 05:00 by default', function (): void {
    expect(BusinessDay::startHour())->toBe(5);
});

test('hours before the boundary still belong to the day before', function (string $moment, string $expected): void {
    expect(BusinessDay::at(Carbon::parse($moment)))->toBe($expected);
})->with([
    'just before midnight' => ['2026-08-14 23:59:00', '2026-08-14'],
    'after midnight' => ['2026-08-15 00:30:00', '2026-08-14'],
    'the last hour of the night' => ['2026-08-15 04:59:00', '2026-08-14'],
    'on the boundary' => ['2026-08-15 05:00:00', '2026-08-15'],
    'mid morning' => ['2026-08-15 09:00:00', '2026-08-15'],
]);

test('it reads the current moment when given none', function (): void {
    Carbon::setTestNow(Carbon::parse('2026-08-15 02:00:00'));

    expect(BusinessDay::at())->toBe('2026-08-14');
});

test('a gym that closes later can move the boundary', function (): void {
    Setting::query()->create(['key' => BusinessDay::SETTING_KEY, 'value' => 7]);

    expect(BusinessDay::startHour())->toBe(7)
        ->and(BusinessDay::at(Carbon::parse('2026-08-15 06:30:00')))->toBe('2026-08-14')
        ->and(BusinessDay::at(Carbon::parse('2026-08-15 07:30:00')))->toBe('2026-08-15');
});

/**
 * A bad row would silently move every shift's business date, and the money
 * filed under the wrong day is far harder to notice than a setting that did
 * not take effect.
 */
test('an out-of-range or non-numeric hour falls back to the default', function (mixed $stored): void {
    Setting::query()->create(['key' => BusinessDay::SETTING_KEY, 'value' => $stored]);

    expect(BusinessDay::startHour())->toBe(BusinessDay::DEFAULT_START_HOUR);
})->with([
    'too large' => [24],
    'negative' => [-1],
    'not a number' => ['morning'],
    'null' => [null],
]);

test('four hours shut ends the trading day by default', function (): void {
    expect(BusinessDay::closedGapHours())->toBe(4);
});

test('it reads a closure against how long the desk has actually been shut', function (string $closedAt, string $now, bool $ended): void {
    expect(BusinessDay::closedLongEnough(Carbon::parse($closedAt), Carbon::parse($now)))->toBe($ended);
})->with([
    'handover between two shifts' => ['2026-08-17 15:00:00', '2026-08-17 15:10:00', false],
    'a long break, still short of the threshold' => ['2026-08-17 15:00:00', '2026-08-17 18:30:00', false],
    'exactly the threshold' => ['2026-08-17 15:00:00', '2026-08-17 19:00:00', true],
    'the gym shut at 3am and opened at 9am' => ['2026-08-18 03:00:00', '2026-08-18 09:00:00', true],
    'friday close to saturday open' => ['2026-08-21 19:00:00', '2026-08-22 09:00:00', true],
]);

/** A session that was never closed cannot say how long the desk sat idle. */
test('an unclosed session does not end the day on its own', function (): void {
    expect(BusinessDay::closedLongEnough(null))->toBeFalse();
});

test('the closure threshold is configurable and refuses nonsense', function (mixed $stored, int $expected): void {
    Setting::query()->create(['key' => BusinessDay::CLOSED_GAP_SETTING_KEY, 'value' => $stored]);

    expect(BusinessDay::closedGapHours())->toBe($expected);
})->with([
    'a gym with a longer midday break' => [6, 6],
    'under an hour would fire between two shifts' => [0, 4],
    'past a day could never fire' => [25, 4],
    'not a number' => ['overnight', 4],
]);

test('previous names the working day that just ended', function (): void {
    // 05:10 on the 15th: the day that just finished is the 14th, which ran until
    // 05:00 that same morning.
    expect(BusinessDay::previous(Carbon::parse('2026-08-15 05:10:00')))->toBe('2026-08-14')
        ->and(BusinessDay::previous(Carbon::parse('2026-08-15 03:00:00')))->toBe('2026-08-13');
});
