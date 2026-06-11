<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Resources\AuditLogResource;
use App\Http\Requests\AuditLog\IndexAuditLogRequest;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Spatie\Activitylog\Models\Activity;
use Spatie\QueryBuilder\QueryBuilder;

final class AuditLogController extends ApiController
{
    public function index(IndexAuditLogRequest $request): AnonymousResourceCollection
    {
        $query   = Activity::query()->with(['causer', 'subject']);
        $filters = $request->input('filter', []);

        if (isset($filters['from'])) {
            $query->where('created_at', '>=', $filters['from'].' 00:00:00');
        }
        if (isset($filters['to'])) {
            $query->where('created_at', '<=', $filters['to'].' 23:59:59');
        }
        if (isset($filters['subject'])) {
            $fqcn = AuditLogResource::$aliasMap[$filters['subject']];
            $query->where('subject_type', $fqcn);
        }
        if (isset($filters['causer'])) {
            $query->where('causer_id', $filters['causer']);
        }

        $activities = QueryBuilder::for($query)
            ->allowedSorts('created_at')
            ->defaultSort('-created_at')
            ->paginate(15);

        return AuditLogResource::collection($activities)
            ->additional([
                'meta' => [
                    'current_page' => $activities->currentPage(),
                    'per_page'     => $activities->perPage(),
                    'total'        => $activities->total(),
                    'last_page'    => $activities->lastPage(),
                ],
                'message' => 'Audit logs retrieved successfully',
            ]);
    }
}
