<?php

use App\Support\NotificationLink;

test('member link filters the members page down to the member', function (): void {
    $link = NotificationLink::member(12, '01001234567', ['subscription' => 40]);

    expect($link['page'])->toBe('members')
        ->and($link['entity_type'])->toBe('member')
        ->and($link['entity_id'])->toBe(12)
        ->and($link['url'])->toBe('/dashboard/members?member=12&q=01001234567&subscription=40');
});

test('member link falls back to the member id when no phone is stored', function (): void {
    expect(NotificationLink::member(12)['url'])->toBe('/dashboard/members?member=12&q=12');
});

test('payroll link carries the month, employee and payroll id', function (): void {
    $link = NotificationLink::payroll(7, 3, '2026-06');

    expect($link['entity_type'])->toBe('payroll')
        ->and($link['entity_id'])->toBe(7)
        ->and($link['url'])->toBe('/dashboard/payroll?month=2026-06&employee=3&payroll=7');
});

test('employee payroll link normalizes a full date to the payroll month', function (): void {
    expect(NotificationLink::employeePayroll(3, '2026-06-11')['url'])
        ->toBe('/dashboard/payroll?month=2026-06&employee=3');
});

test('attendance link opens the day sheet for the employee', function (): void {
    $link = NotificationLink::attendance(3, '2026-06-11');

    expect($link['entity_type'])->toBe('employee')
        ->and($link['url'])->toBe('/dashboard/attendance?date=2026-06-11&employee=3');
});

test('attendance violation link filters the warnings table to the employee', function (): void {
    $link = NotificationLink::attendanceViolation(9, 3, '2026-06-11', 'late');

    expect($link['entity_type'])->toBe('attendance_violation')
        ->and($link['entity_id'])->toBe(9)
        ->and($link['url'])->toBe(
            '/dashboard/attendance?date=2026-06-11&employee=3&violation=9&warning_employee_id=3&warning_status=all&warning_type=late'
        );
});

test('finance links scope the date range to the record date', function (): void {
    expect(NotificationLink::expense(5, '2026-06-11')['url'])
        ->toBe('/dashboard/finance?from=2026-06-11&to=2026-06-11&expense=5')
        ->and(NotificationLink::shiftSession(2, '2026-06-11')['url'])
        ->toBe('/dashboard/finance?from=2026-06-11&to=2026-06-11&shift_session=2');
});

test('missing values are dropped instead of emitting empty query parameters', function (): void {
    expect(NotificationLink::attendance(null, null)['url'])->toBe('/dashboard/attendance')
        ->and(NotificationLink::task(null)['url'])->toBe('/dashboard/tasks')
        ->and(NotificationLink::product(4)['url'])->toBe('/dashboard/logistics?product=4');
});
