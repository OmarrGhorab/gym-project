<?php

namespace App\Exports;

use App\Models\Sale;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class SalesExport implements FromQuery, WithHeadings, WithMapping
{
    protected array $filters;

    public function __construct(array $filters)
    {
        $this->filters = $filters;
    }

    public function query()
    {
        $query = Sale::query()->with(['member', 'soldBy']);
        $customRequest = new Request(['filter' => $this->filters]);

        return QueryBuilder::for($query, $customRequest)
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::exact('member_id'),
                AllowedFilter::exact('sold_by_user_id'),
                AllowedFilter::exact('payment_method')
            );
    }

    public function headings(): array
    {
        return [
            'ID',
            'Member Name',
            'Subtotal',
            'Discount',
            'Total',
            'Payment Method',
            'Status',
            'Sold By',
            'Created At',
        ];
    }

    public function map($row): array
    {
        return [
            $row->id,
            $row->member?->name,
            number_format($row->subtotal, 2, '.', ''),
            number_format($row->discount, 2, '.', ''),
            number_format($row->total, 2, '.', ''),
            $row->payment_method,
            $row->status,
            $row->soldBy?->name,
            $row->created_at?->toDateTimeString(),
        ];
    }
}
