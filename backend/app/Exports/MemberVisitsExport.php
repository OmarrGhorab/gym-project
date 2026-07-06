<?php

namespace App\Exports;

use App\Models\MemberVisit;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class MemberVisitsExport implements FromQuery, WithHeadings, WithMapping
{
    public function __construct(private readonly array $filters) {}

    public function query()
    {
        $query = MemberVisit::query()->with(['member', 'subscription.plan', 'creator']);
        $customRequest = new Request(['filter' => $this->normalizedFilters()]);

        return QueryBuilder::for($query, $customRequest)
            ->allowedFilters(
                AllowedFilter::exact('member_id'),
                AllowedFilter::exact('status'),
                AllowedFilter::callback('from', function ($query, string $value): void {
                    $query->where('check_in_at', '>=', "{$value} 00:00:00");
                }),
                AllowedFilter::callback('to', function ($query, string $value): void {
                    $query->where('check_in_at', '<=', "{$value} 23:59:59");
                }),
            )
            ->allowedSorts('check_in_at', 'created_at')
            ->defaultSort('check_in_at');
    }

    public function headings(): array
    {
        return [
            'ID',
            'Member',
            'Phone',
            'Subscription Plan',
            'Subscription Status',
            'Check In',
            'Check Out',
            'Status',
            'Scan Method',
            'Alert',
            'Check In GPS',
            'Check Out GPS',
            'Recorded By',
            'Notes',
        ];
    }

    public function map($row): array
    {
        return [
            $row->id,
            $row->member?->name,
            $row->member?->phone,
            $row->subscription?->plan?->name,
            $row->subscription?->status,
            $row->check_in_at?->toDateTimeString(),
            $row->check_out_at?->toDateTimeString(),
            $row->status,
            $row->scan_method,
            $row->alert_reason,
            $row->check_in_location_status,
            $row->check_out_location_status,
            $row->creator?->name,
            $row->notes,
        ];
    }

    private function normalizedFilters(): array
    {
        if (($this->filters['period'] ?? null) === 'monthly' && isset($this->filters['month'])) {
            $from = "{$this->filters['month']}-01";

            return [
                'from' => $from,
                'to' => Carbon::parse($from)->endOfMonth()->toDateString(),
            ];
        }

        if (isset($this->filters['date'])) {
            return [
                'from' => $this->filters['date'],
                'to' => $this->filters['date'],
            ];
        }

        return $this->filters;
    }
}
