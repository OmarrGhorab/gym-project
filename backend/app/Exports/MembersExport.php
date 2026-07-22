<?php

namespace App\Exports;

use App\Models\Member;
use App\Support\ArabicSearch;
use Illuminate\Http\Request;
use Maatwebsite\Excel\Concerns\FromQuery;
use Maatwebsite\Excel\Concerns\ShouldAutoSize;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;
use Maatwebsite\Excel\Events\AfterSheet;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

class MembersExport implements FromQuery, ShouldAutoSize, WithEvents, WithHeadings, WithMapping
{
    protected array $filters;

    public function __construct(array $filters, protected string $locale = 'en')
    {
        $this->filters = $filters;
        $this->locale = $locale === 'ar' ? 'ar' : 'en';
    }

    public function query()
    {
        $query = Member::withTotalPaid()->with('latestSubscription');

        $customRequest = new Request(['filter' => $this->filters]);

        return QueryBuilder::for($query, $customRequest)
            ->allowedFilters(
                AllowedFilter::exact('status'),
                AllowedFilter::callback('subscription_status', function ($query, string $value): void {
                    if ($value === 'none') {
                        $query->whereDoesntHave('subscriptions');

                        return;
                    }

                    $query->whereHas('subscriptions', function ($subscriptionQuery) use ($value): void {
                        $subscriptionQuery->where('status', $value);
                    });
                }),
                AllowedFilter::callback('qr', function ($query, string $value): void {
                    if ($value === 'ready') {
                        $query->whereNotNull('attendance_code');

                        return;
                    }

                    if ($value === 'missing') {
                        $query->whereNull('attendance_code');
                    }
                }),
                AllowedFilter::callback('search', function ($query, string $value): void {
                    $value = trim($value);
                    $normalizedNameLike = ArabicSearch::like($value, startsWith: true);

                    $query->where(function ($q) use ($normalizedNameLike, $value): void {
                        $q->where('name', 'like', "{$value}%")
                            ->orWhereRaw(ArabicSearch::normalizedColumn('members.name').' LIKE ?', [$normalizedNameLike])
                            ->orWhere('phone', 'like', "{$value}%")
                            ->orWhere('phone', 'like', '+'.$value.'%');
                    });
                }),
            );
    }

    public function headings(): array
    {
        return $this->isArabic()
            ? ['المعرف', 'الاسم', 'الهاتف', 'البريد الإلكتروني', 'النوع', 'الرقم القومي', 'تاريخ الانضمام', 'تاريخ الانتهاء', 'الحالة', 'إجمالي المدفوع', 'تاريخ الإنشاء']
            : ['ID', 'Name', 'Phone', 'Email', 'Gender', 'National ID', 'Join Date', 'Expiration Date', 'Status', 'Total Paid', 'Created At'];
    }

    public function map($row): array
    {
        return [
            $row->id,
            $row->name,
            $row->phone,
            $row->email,
            $this->translateGender($row->gender),
            $row->national_id,
            $row->join_date?->toDateString(),
            $row->latestSubscription?->end_date?->toDateString(),
            $this->translateStatus($row->status),
            number_format($row->total_paid, 2, '.', ''),
            $row->created_at?->toDateTimeString(),
        ];
    }

    public function exportRows(): array
    {
        return $this->query()
            ->get()
            ->map(fn (Member $member) => $this->map($member))
            ->all();
    }

    public function isRtl(): bool
    {
        return $this->isArabic();
    }

    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function (AfterSheet $event): void {
                if ($this->isArabic()) {
                    $event->sheet->getDelegate()->setRightToLeft(true);
                }
            },
        ];
    }

    private function isArabic(): bool
    {
        return $this->locale === 'ar';
    }

    private function translateGender(?string $value): ?string
    {
        if (! $this->isArabic()) {
            return $value;
        }

        return match ($value) {
            'male' => 'ذكر',
            'female' => 'أنثى',
            default => $value,
        };
    }

    private function translateStatus(?string $value): ?string
    {
        if (! $this->isArabic()) {
            return $value;
        }

        return match ($value) {
            'active' => 'نشط',
            'inactive' => 'غير نشط',
            default => $value,
        };
    }
}
