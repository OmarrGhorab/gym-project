<?php

namespace App\Actions\Attendance;

use App\Models\Employee;
use App\Models\Member;
use App\Support\AttendanceCode;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use InvalidArgumentException;

final class ResolveAttendanceIdentity
{
    public function member(array $data): Member
    {
        if (! empty($data['qr_token'])) {
            $payload = AttendanceCode::parseForType((string) $data['qr_token'], 'member');
            if ($payload['type'] !== 'member') {
                throw new InvalidArgumentException('QR code does not belong to a member.');
            }

            return Member::query()->where('attendance_code', $payload['code'])->firstOrFail();
        }

        if (! empty($data['member_id'])) {
            return Member::query()->findOrFail($data['member_id']);
        }

        if (! empty($data['phone'])) {
            return Member::query()
                ->where('phone', $data['phone'])
                ->orWhere('phone', '+'.$data['phone'])
                ->firstOrFail();
        }

        if (! empty($data['name'])) {
            $member = Member::query()
                ->where('name', 'like', trim((string) $data['name']).'%')
                ->orderBy('name')
                ->first();

            if ($member) {
                return $member;
            }
        }

        throw (new ModelNotFoundException)->setModel(Member::class);
    }

    public function employee(array $data): Employee
    {
        if (! empty($data['qr_token'])) {
            $payload = AttendanceCode::parseForType((string) $data['qr_token'], 'employee');
            if ($payload['type'] !== 'employee') {
                throw new InvalidArgumentException('QR code does not belong to an employee.');
            }

            return Employee::query()->where('attendance_code', $payload['code'])->firstOrFail();
        }

        if (! empty($data['employee_id'])) {
            return Employee::query()->findOrFail($data['employee_id']);
        }

        throw (new ModelNotFoundException)->setModel(Employee::class);
    }
}
