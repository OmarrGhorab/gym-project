<?php

namespace App\Support;

/**
 * Builds the deep link every operational notification carries so the dashboard
 * can open the exact record the notification is about instead of a bare page.
 *
 * The returned shape is stored on the notification payload as:
 *   'url'  => the ready-to-use dashboard href
 *   'link' => ['page', 'entity_type', 'entity_id', 'url']
 *
 * Query keys are the ones the dashboard pages read (members: q, attendance:
 * date/warning_*, payroll: month, finance: from/to), plus the record id so a
 * page can highlight the row it was opened for.
 */
final class NotificationLink
{
    /**
     * @param  array<string, mixed>  $query
     * @return array{page: string, entity_type: string|null, entity_id: int|string|null, url: string}
     */
    public static function to(string $page, ?string $entityType = null, int|string|null $entityId = null, array $query = []): array
    {
        return [
            'page' => $page,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'url' => self::url($page, $query),
        ];
    }

    /**
     * Members list filtered down to one member (the list searches phone and id).
     *
     * @param  array<string, mixed>  $query
     * @return array{page: string, entity_type: string|null, entity_id: int|string|null, url: string}
     */
    public static function member(?int $memberId, ?string $phone = null, array $query = []): array
    {
        return self::to('members', 'member', $memberId, [
            'member' => $memberId,
            'q' => self::filled($phone) ? $phone : $memberId,
            ...$query,
        ]);
    }

    /**
     * Payroll month containing one payroll run.
     *
     * @return array{page: string, entity_type: string|null, entity_id: int|string|null, url: string}
     */
    public static function payroll(?int $payrollId, ?int $employeeId, ?string $month): array
    {
        return self::to('payroll', 'payroll', $payrollId, [
            'month' => self::month($month),
            'employee' => $employeeId,
            'payroll' => $payrollId,
        ]);
    }

    /**
     * Payroll month for one employee, used when the record is not a payroll row
     * itself (attendance deductions and bonuses that land on the salary).
     *
     * @param  array<string, mixed>  $query
     * @return array{page: string, entity_type: string|null, entity_id: int|string|null, url: string}
     */
    public static function employeePayroll(?int $employeeId, ?string $month, array $query = []): array
    {
        return self::to('payroll', 'employee', $employeeId, [
            'month' => self::month($month),
            'employee' => $employeeId,
            ...$query,
        ]);
    }

    /**
     * Attendance day sheet for one employee.
     *
     * @param  array<string, mixed>  $query
     * @return array{page: string, entity_type: string|null, entity_id: int|string|null, url: string}
     */
    public static function attendance(?int $employeeId, ?string $date, array $query = []): array
    {
        return self::to('attendance', 'employee', $employeeId, [
            'date' => $date,
            'employee' => $employeeId,
            ...$query,
        ]);
    }

    /**
     * Attendance day sheet with the warnings table filtered to one violation.
     *
     * @return array{page: string, entity_type: string|null, entity_id: int|string|null, url: string}
     */
    public static function attendanceViolation(?int $violationId, ?int $employeeId, ?string $date, ?string $type = null): array
    {
        return self::to('attendance', 'attendance_violation', $violationId, [
            'date' => $date,
            'employee' => $employeeId,
            'violation' => $violationId,
            'warning_employee_id' => $employeeId,
            'warning_status' => 'all',
            'warning_type' => $type,
        ]);
    }

    /**
     * @return array{page: string, entity_type: string|null, entity_id: int|string|null, url: string}
     */
    public static function task(?int $taskId): array
    {
        return self::to('tasks', 'task', $taskId, ['task' => $taskId]);
    }

    /**
     * @return array{page: string, entity_type: string|null, entity_id: int|string|null, url: string}
     */
    public static function product(?int $productId): array
    {
        return self::to('logistics', 'product', $productId, ['product' => $productId]);
    }

    /**
     * Finance page scoped to the expense date.
     *
     * @return array{page: string, entity_type: string|null, entity_id: int|string|null, url: string}
     */
    public static function expense(?int $expenseId, ?string $date): array
    {
        return self::to('finance', 'expense', $expenseId, [
            'from' => $date,
            'to' => $date,
            'expense' => $expenseId,
        ]);
    }

    /**
     * Finance page scoped to the shift session business date.
     *
     * @return array{page: string, entity_type: string|null, entity_id: int|string|null, url: string}
     */
    public static function shiftSession(?int $sessionId, ?string $businessDate): array
    {
        return self::to('finance', 'shift_session', $sessionId, [
            'from' => $businessDate,
            'to' => $businessDate,
            'shift_session' => $sessionId,
        ]);
    }

    /**
     * @param  array<string, mixed>  $query
     */
    private static function url(string $page, array $query): string
    {
        $path = '/dashboard/'.trim($page, '/');
        $filtered = array_filter($query, static fn ($value): bool => self::filled($value));

        return $filtered === [] ? $path : $path.'?'.http_build_query($filtered);
    }

    /**
     * Accepts a date or a month and always returns the YYYY-MM the page expects.
     */
    private static function month(?string $value): ?string
    {
        return self::filled($value) ? substr((string) $value, 0, 7) : null;
    }

    private static function filled(mixed $value): bool
    {
        return $value !== null && $value !== '';
    }
}
