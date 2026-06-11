<?php

namespace App\Jobs;

use App\Actions\Export\BuildExport;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;
use Maatwebsite\Excel\Facades\Excel;

class GenerateExportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        protected string $exportId,
        protected string $resource,
        protected string $format,
        protected array $filters,
        protected int $userId
    ) {}

    public function handle(): void
    {
        $cacheKey = "export:{$this->exportId}";

        try {
            $builder = new BuildExport;
            $exportClass = $builder->getExportClass($this->resource, $this->filters);
            $writerType = $builder->getWriterType($this->format);

            $filename = "exports/{$this->exportId}.{$this->format}";
            $disk = Config::get('export.disk', 'local');

            // Generate and store file
            Excel::store($exportClass, $filename, $disk, $writerType);

            // Update cache status to completed
            Cache::put($cacheKey, [
                'id' => $this->exportId,
                'resource' => $this->resource,
                'format' => $this->format,
                'status' => 'completed',
                'user_id' => $this->userId,
                'filename' => $filename,
            ], now()->addHours(Config::get('export.retention_hours', 24)));

            // Log successful export in audit log
            activity()
                ->causedBy($this->userId)
                ->log("Exported {$this->resource} in {$this->format} format");

        } catch (\Throwable $e) {
            Log::error('Export job failed: '.$e->getMessage(), [
                'export_id' => $this->exportId,
                'exception' => $e,
            ]);

            // Update cache status to failed
            Cache::put($cacheKey, [
                'id' => $this->exportId,
                'resource' => $this->resource,
                'format' => $this->format,
                'status' => 'failed',
                'user_id' => $this->userId,
                'error' => $e->getMessage(),
            ], now()->addHours(Config::get('export.retention_hours', 24)));

            // Log failure in audit log
            activity()
                ->causedBy($this->userId)
                ->log("Export job failed for {$this->resource} in {$this->format} format");

            throw $e;
        }
    }
}
