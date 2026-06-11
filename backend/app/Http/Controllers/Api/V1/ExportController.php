<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Export\BuildExport;
use App\Http\Requests\Export\ExportRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class ExportController extends ApiController
{
    public function export(ExportRequest $request, string $resource, BuildExport $action)
    {
        $format  = strtolower($request->validated('format'));
        $filters = $request->input('filter', []);

        $result = $action->handle($resource, $format, $filters, $request->user());

        if ($result['queued']) {
            $downloadUrl = URL::temporarySignedRoute(
                'export.download',
                now()->addHours(config('export.retention_hours', 24)),
                ['exportId' => $result['export_id']]
            );

            return $this->success(
                data: [
                    'export_id'    => $result['export_id'],
                    'status'       => $result['status'],
                    'download_url' => $downloadUrl,
                ],
                message: 'Export is being processed in the background.',
                status: 202
            );
        }

        return $result['response'];
    }

    public function download(Request $request, string $exportId)
    {
        // Signed URL validity + ownership are both enforced by middleware.
        $metadata = Cache::get("export:{$exportId}");

        if (! $metadata) {
            return $this->error(
                code: 'not_found',
                message: 'Export file not found or has expired.',
                details: (object) [],
                status: 404
            );
        }

        if ($metadata['status'] === 'processing') {
            return $this->success(
                data: [
                    'export_id' => $exportId,
                    'status'    => 'processing',
                ],
                message: 'Export is still processing.',
                status: 202
            );
        }

        if ($metadata['status'] === 'failed') {
            return $this->error(
                code: 'export_failed',
                message: 'The export job failed.',
                details: ['error' => $metadata['error'] ?? 'Unknown error'],
                status: 500
            );
        }

        $disk     = config('export.disk', 'local');
        $filename = $metadata['filename'];

        if (! Storage::disk($disk)->exists($filename)) {
            return $this->error(
                code: 'not_found',
                message: 'Export file does not exist on disk.',
                details: (object) [],
                status: 404
            );
        }

        return Storage::disk($disk)->download(
            $filename,
            "{$metadata['resource']}_export.{$metadata['format']}"
        );
    }

    public function status(Request $request, string $exportId)
    {
        // Ownership enforced by the can:download-export gate in middleware.
        // The status route intentionally does not require a signed URL — the gate
        // checks metadata['user_id'] === $user->id directly (see AppServiceProvider).
        $metadata = Cache::get("export:{$exportId}");

        if (! $metadata) {
            return $this->error(
                code: 'not_found',
                message: 'Export not found.',
                details: (object) [],
                status: 404
            );
        }

        return $this->success(
            data: [
                'export_id' => $metadata['id'],
                'status'    => $metadata['status'],
                'resource'  => $metadata['resource'],
                'format'    => $metadata['format'],
            ],
            message: 'Export status retrieved'
        );
    }
}
