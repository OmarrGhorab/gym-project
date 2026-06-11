<?php

namespace App\Exports;

use App\Models\Subscription;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class SubscriptionsExport implements FromQuery, WithHeadings, WithMapping
{
    protected array $filters;

    public function __construct(array $filters)
    {
        $this->filters = $filters;
    }

    public function query()
    {
        $query = Subscription::query()->with(['member', 'plan', 'soldBy']);
        $customRequest = new Request(['filter' => $this->filters]);

        return QueryBuilder::for($query, $customRequest)
            ->allowedFilters(
                AllowedFilter::exact('member_id'),
                AllowedFilter::exact('status')
            );
    }

    public function headings(): array
    {
        return [
            'ID',
            'Member Name',
            'Plan Name',
            'Price',
            'Status',
            'Start Date',
            'End Date',
            'Sold By',
            'Created At',
        ];
    }

    public function map($row): array
    {
        return [
            $row->id,
            $row->member?->name,
            $row->plan?->name,
            number_format($row->price, 2, '.', ''),
            $row->status,
            $row->start_date?->toDateString(),
            $row->end_date?->toDateString(),
            $row->soldBy?->name,
            $row->created_at?->toDateTimeString(),
        ];
    }
}
