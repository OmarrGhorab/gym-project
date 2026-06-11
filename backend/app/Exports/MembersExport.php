<?php

namespace App\Exports;

use App\Models\Member;
use App\Models\Payment;
use App\Models\Subscription;
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
        $query = Member::query()
            ->select('members.*')
            ->selectSub(
                Payment::query()
                    ->selectRaw('COALESCE(SUM(payments.amount), 0)')
                    ->join('subscriptions', function ($join): void {
                        $join->on('subscriptions.id', '=', 'payments.payable_id')
                            ->where('payments.payable_type', '=', Subscription::class);
                    })
                    ->whereColumn('subscriptions.member_id', 'members.id'),
                'total_paid',
            );

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
            'Birth Date',
            'National ID',
            'Join Date',
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
            $row->birth_date?->toDateString(),
            $row->national_id,
            $row->join_date,
            $row->status,
            number_format($row->total_paid, 2, '.', ''),
            $row->created_at?->toDateTimeString(),
        ];
    }
}
