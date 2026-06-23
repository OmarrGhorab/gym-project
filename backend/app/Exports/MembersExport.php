<?php

namespace App\Exports;

use App\Models\Member;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class MembersExport implements FromQuery, WithHeadings, WithMapping
{
    protected array $filters;

    public function __construct(array $filters)
    {
        $this->filters = $filters;
    }

    public function query()
    {
        $query = Member::withTotalPaid()->with('latestSubscription');

        $customRequest = new Request(['filter' => $this->filters]);

        return QueryBuilder::for($query, $customRequest)
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::callback('search', function ($query, string $value): void {
                    $value = trim($value);
                    $query->where(function ($q) use ($value): void {
                        $q->where('name', 'like', "{$value}%")
                            ->orWhere('phone', 'like', "{$value}%")
                            ->orWhere('phone', 'like', '+'.$value.'%');
                    });
                }),
            );
    }

    public function headings(): array
    {
        return [
            'ID',
            'Name',
            'Phone',
            'Email',
            'Gender',
            'National ID',
            'Join Date',
            'Expiration Date',
            'Status',
            'Total Paid',
            'Created At',
        ];
    }

    public function map($row): array
    {
        return [
            $row->id,
            $row->name,
            $row->phone,
            $row->email,
            $row->gender,
            $row->national_id,
            $row->join_date?->toDateString(),
            $row->latestSubscription?->end_date?->toDateString(),
            $row->status,
            number_format($row->total_paid, 2, '.', ''),
            $row->created_at?->toDateTimeString(),
        ];
    }
}
