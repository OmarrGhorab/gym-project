<?php

namespace App\Actions\Export;

use App\Exports\MembersExport;
use App\Exports\PaymentsExport;
use App\Exports\PayrollExport;
use App\Exports\ReportExport;
use App\Exports\SalesExport;
use App\Exports\SubscriptionsExport;
use App\Jobs\GenerateExportJob;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Facades\Excel;

class BuildExport
{
    public function handle(string $resource, string $format, array $filters, $user): array
    {
        $exportClass = $this->getExportClass($resource, $filters);
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
                'status' => 'processing',
                'user_id' => $user->id,
            ], now()->addHours(Config::get('export.retention_hours', 24)));

            // Dispatch job
            GenerateExportJob::dispatch($exportId, $resource, $format, $filters, $user->id);

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

        return [
            'queued' => false,
            'response' => Excel::download($exportClass, "{$resource}.{$format}", $writerType),
        ];
    }

    public function getExportClass(string $resource, array $filters)
    {
        return match ($resource) {
            'members' => new MembersExport($filters),
            'subscriptions' => new SubscriptionsExport($filters),
            'sales' => new SalesExport($filters),
            'payments' => new PaymentsExport($filters),
            'payroll' => new PayrollExport($filters),
            'reports' => new ReportExport($filters),
            default => throw new \InvalidArgumentException("Invalid resource: {$resource}"),
        };
    }

    private function getExportCount($exportClass): int
    {
        if (method_exists($exportClass, 'query')) {
            return $exportClass->query()->count();
        }

        if (method_exists($exportClass, 'collection')) {
            return $exportClass->collection()->count();
        }

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
}
