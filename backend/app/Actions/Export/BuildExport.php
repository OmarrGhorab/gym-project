<?php

namespace App\Actions\Export;

use App\Actions\Reports\FinanceDetailedExportData;
use App\Exports\AttendanceExport;
use App\Exports\FinanceDetailedWorkbookExport;
use App\Exports\MembersExport;
use App\Exports\MemberVisitsExport;
use App\Exports\PaymentsExport;
use App\Exports\PayrollExport;
use App\Exports\ReportExport;
use App\Exports\SalesExport;
use App\Exports\SubscriptionsExport;
use App\Jobs\GenerateExportJob;
use ArPHP\I18N\Arabic;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;

class BuildExport
{
    public function handle(string $resource, string $format, array $filters, $user, string $locale = 'en'): array
    {
        if ($this->isDetailedFinanceExport($resource, $filters)) {
            return $this->handleDetailedFinanceExport($format, $filters, $user, $locale);
        }

        $exportClass = $this->getExportClass($resource, $filters, $locale);
        $totalRows = $this->getExportCount($exportClass);
        $threshold = Config::get('export.sync_threshold', 5000);

        $writerType = $this->getWriterType($format);

        if ($totalRows > $threshold) {
            $exportId = (string) Str::uuid();

            // Set initial state in Cache
            Cache::put("export:{$exportId}", [
                'id' => $exportId,
                'resource' => $resource,
                'format' => $format,
                'locale' => $locale,
                'status' => 'processing',
                'user_id' => $user->id,
            ], now()->addHours(Config::get('export.retention_hours', 24)));

            // Dispatch job
            GenerateExportJob::dispatch($exportId, $resource, $format, $filters, $user->id, $locale);

            return [
                'queued' => true,
                'export_id' => $exportId,
                'status' => 'processing',
            ];
        }

        // Log successful sync export in audit log
        activity()
            ->causedBy($user)
            ->log("Exported {$resource} in {$format} format");

        try {
            if ($resource === 'members' && $format === 'pdf' && $exportClass instanceof MembersExport) {
                $response = response($this->buildMembersPdf($exportClass), 200, [
                    'Content-Type' => 'application/pdf',
                    'Content-Disposition' => 'attachment; filename="members.pdf"',
                ]);
            } else {
                $response = Excel::download($exportClass, "{$resource}.{$format}", $writerType);
            }
        } catch (\Throwable $e) {
            return [
                'queued' => false,
                'error' => true,
                'message' => $e->getMessage(),
            ];
        }

        return [
            'queued' => false,
            'response' => $response,
        ];
    }

    public function getExportClass(string $resource, array $filters, string $locale = 'en')
    {
        return match ($resource) {
            'attendance' => new AttendanceExport($filters),
            'member-visits' => new MemberVisitsExport($filters),
            'members' => new MembersExport($filters, $locale),
            'subscriptions' => new SubscriptionsExport($filters),
            'sales' => new SalesExport($filters),
            'payments' => new PaymentsExport($filters),
            'payroll' => new PayrollExport($filters),
            'reports' => new ReportExport($filters),
            default => throw new \InvalidArgumentException("Invalid resource: {$resource}"),
        };
    }

    private function isDetailedFinanceExport(string $resource, array $filters): bool
    {
        return $resource === 'reports' && ($filters['type'] ?? null) === 'financial_detailed';
    }

    private function handleDetailedFinanceExport(string $format, array $filters, $user, string $locale): array
    {
        activity()
            ->causedBy($user)
            ->log("Exported detailed finance report in {$format} format");

        try {
            if ($format === 'pdf') {
                $response = response($this->buildFinancePdf($filters, $locale), 200, [
                    'Content-Type' => 'application/pdf',
                    'Content-Disposition' => 'attachment; filename="finance-report.pdf"',
                ]);
            } else {
                $response = Excel::download(
                    new FinanceDetailedWorkbookExport($filters),
                    "finance-report.{$format}",
                    $this->getWriterType($format)
                );
            }
        } catch (\Throwable $e) {
            return [
                'queued' => false,
                'error' => true,
                'message' => $e->getMessage(),
            ];
        }

        return [
            'queued' => false,
            'response' => $response,
        ];
    }

    private function getExportCount($exportClass): int
    {
        if (method_exists($exportClass, 'query')) {
            return $exportClass->query()->toBase()->getCountForPagination();
        }

        // FromCollection exports (e.g. ReportExport) produce inherently small,
        // aggregated result sets. Materialising the collection just to count it
        // defeats the purpose of the threshold gate, so always run them sync.
        return 0;
    }

    public function getWriterType(string $format): string
    {
        return match (strtolower($format)) {
            'xlsx' => \Maatwebsite\Excel\Excel::XLSX,
            'csv' => \Maatwebsite\Excel\Excel::CSV,
            'pdf' => \Maatwebsite\Excel\Excel::DOMPDF,
            default => throw new \InvalidArgumentException("Invalid format: {$format}"),
        };
    }

    public function storeMembersPdf(MembersExport $export, string $filename): void
    {
        $disk = config('export.disk', 'local');
        Storage::disk($disk)->put($filename, $this->buildMembersPdf($export));
    }

    private function buildMembersPdf(MembersExport $export): string
    {
        $arabic = new Arabic;

        $pdf = Pdf::loadView('exports.members-pdf', [
            'columns' => $export->headings(),
            'isRtl' => $export->isRtl(),
            'pdfArabic' => static fn (mixed $value): string => match (true) {
                is_string($value) && $value !== '' => $arabic->utf8Glyphs($value, 120, false, true),
                is_numeric($value) => (string) $value,
                default => '',
            },
            'rows' => $export->exportRows(),
        ])->setPaper('a4', 'landscape')
            ->setOption('defaultFont', 'DejaVu Sans')
            ->setOption('isHtml5ParserEnabled', true);

        return $pdf->output();
    }

    private function buildFinancePdf(array $filters, string $locale): string
    {
        $arabic = new Arabic;
        $report = app(FinanceDetailedExportData::class)->build($filters);
        $isRtl = $locale === 'ar';

        $pdf = Pdf::loadView('exports.finance-report-pdf', [
            'isRtl' => $isRtl,
            'pdfText' => static function (mixed $value) use ($arabic, $isRtl): string {
                if ($value === null) {
                    return '';
                }

                if (is_numeric($value)) {
                    return number_format((float) $value, 2, '.', '');
                }

                $stringValue = (string) $value;

                if (! $isRtl || $stringValue === '') {
                    return $stringValue;
                }

                return $arabic->utf8Glyphs($stringValue, 120, false, true);
            },
            'report' => $report,
        ])->setPaper('a4', 'landscape')
            ->setOption('defaultFont', 'DejaVu Sans')
            ->setOption('isHtml5ParserEnabled', true);

        return $pdf->output();
    }
}
