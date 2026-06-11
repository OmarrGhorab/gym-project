<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class PruneExpiredExports extends Command
{
    protected $signature = 'exports:prune';

    protected $description = 'Prune temporary export files older than configured retention period';

    public function handle(): int
    {
        $disk = config('export.disk', 'local');
        $retentionHours = config('export.retention_hours', 24);
        $thresholdTime = now()->subHours($retentionHours)->timestamp;

        $files = Storage::disk($disk)->files('exports');
        $deletedCount = 0;

        foreach ($files as $file) {
            try {
                $lastModified = Storage::disk($disk)->lastModified($file);

                if ($lastModified < $thresholdTime) {
                    Storage::disk($disk)->delete($file);
                    $deletedCount++;
                }
            } catch (\Throwable $e) {
                $this->error("Failed to delete export file {$file}: {$e->getMessage()}");
            }
        }

        $this->info("Pruned {$deletedCount} expired export files.");

        return Command::SUCCESS;
    }
}
