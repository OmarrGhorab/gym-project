<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Export\BuildExport;
use App\Support\SystemPermissions;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;

class ExportController extends ApiController
{
    public function export(Request $request, string $resource, BuildExport $action)
    {
        // 1. Validate resource
        $validResources = array_keys(SystemPermissions::EXPORT_PERMISSION_MAP);
        if (! in_array($resource, $validResources, true)) {
            return $this->error(
                code: 'validation_failed',
                message: 'The requested resource is invalid.',
                details: ['resource' => ['The selected resource is invalid.']],
                status: 422
            );
        }

        // 2. Validate format
        $format = $request->string('format')->toString();
        if (! in_array(strtolower($format), ['xlsx', 'csv', 'pdf'], true)) {
            return $this->error(
                code: 'validation_failed',
                message: 'The requested format is invalid.',
                details: ['format' => ['The selected format is invalid.']],
                status: 422
            );
        }

        // 3. Authorize export
        $permission = SystemPermissions::EXPORT_PERMISSION_MAP[$resource];
        if (! $request->user()->can($permission)) {
            return $this->error(
                code: 'forbidden',
                message: 'You do not have permission to export this resource.',
                details: (object) [],
                status: 403
            );
        }

        $filters = $request->input('filter', $request->except(['format']));

        // Call the export rate limiter (FR-027 rate limits login, POS, export)
        // Rate limiter is defined in AppServiceProvider.

        $result = $action->handle($resource, $format, $filters, $request->user());

        if ($result['queued']) {
            // Generate temporary signed URL for retrieval
            $downloadUrl = URL::temporarySignedRoute(
                'export.download',
                now()->addHours(config('export.retention_hours', 24)),
                ['exportId' => $result['export_id']]
            );

            return $this->success(
                data: [
                    'export_id' => $result['export_id'],
                    'status' => $result['status'],
                    'download_url' => $downloadUrl,
                ],
                message: 'Export is being processed in the background.',
                status: 202
            );
        }

        // It is synchronous - return the download response
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
                    'status' => 'processing',
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

        $disk = config('export.disk', 'local');
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
                'status' => $metadata['status'],
                'resource' => $metadata['resource'],
                'format' => $metadata['format'],
            ],
            message: 'Export status retrieved'
        );
    }
}
