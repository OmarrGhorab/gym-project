<?php

namespace App\Jobs;

use App\Actions\Export\BuildExport;
use App\Exports\MembersExport;
use App\Models\User;
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

    public int $timeout = 600;

    public int $tries = 1;

    public function __construct(
        protected string $exportId,
        protected string $resource,
        protected string $format,
        protected array $filters,
        protected int $userId,
        protected string $locale = 'en'
    ) {
        $this->onQueue('exports');
    }

    public function handle(): void
    {
        $cacheKey = "export:{$this->exportId}";
        $causer = User::find($this->userId);

        try {
            $builder = new BuildExport;
            $exportClass = $builder->getExportClass($this->resource, $this->filters, $this->locale);
            $writerType = $builder->getWriterType($this->format);

            $filename = "exports/{$this->exportId}.{$this->format}";
            $disk = Config::get('export.disk', 'local');

            if ($this->resource === 'members' && $this->format === 'pdf' && $exportClass instanceof MembersExport) {
                $builder->storeMembersPdf($exportClass, $filename);
            } else {
                Excel::store($exportClass, $filename, $disk, $writerType);
            }

            Cache::put($cacheKey, [
                'id' => $this->exportId,
                'resource' => $this->resource,
                'format' => $this->format,
                'locale' => $this->locale,
                'status' => 'completed',
                'user_id' => $this->userId,
                'filename' => $filename,
            ], now()->addHours(Config::get('export.retention_hours', 24)));

            activity()
                ->causedBy($causer)
                ->log("Exported {$this->resource} in {$this->format} format");

        } catch (\Throwable $e) {
            Log::error('Export job failed: '.$e->getMessage(), [
                'export_id' => $this->exportId,
                'exception' => $e,
            ]);

            Cache::put($cacheKey, [
                'id' => $this->exportId,
                'resource' => $this->resource,
                'format' => $this->format,
                'locale' => $this->locale,
                'status' => 'failed',
                'user_id' => $this->userId,
                'error' => $e->getMessage(),
            ], now()->addHours(Config::get('export.retention_hours', 24)));

            activity()
                ->causedBy($causer)
                ->log("Export job failed for {$this->resource} in {$this->format} format");

            throw $e;
        }
    }
}
