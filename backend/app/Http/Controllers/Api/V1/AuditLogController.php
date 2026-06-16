<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Requests\AuditLog\IndexAuditLogRequest;
use App\Http\Resources\AuditLogResource;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Spatie\Activitylog\Models\Activity;
use Spatie\QueryBuilder\QueryBuilder;

final class AuditLogController extends ApiController
{
    public function index(IndexAuditLogRequest $request): AnonymousResourceCollection
    {
        $query = Activity::query()->with(['causer', 'subject']);

        $from = $request->validated('filter.from');
        $to = $request->validated('filter.to');
        $subject = $request->validated('filter.subject');
        $causer = $request->validated('filter.causer');

        if ($from) {
            $query->where('created_at', '>=', $from.' 00:00:00');
        }
        if ($to) {
            $query->where('created_at', '<=', $to.' 23:59:59');
        }
        if ($subject) {
            $query->where('subject_type', AuditLogResource::$aliasMap[$subject]);
        }
        if ($causer) {
            $query->where('causer_id', $causer);
        }

        $activities = QueryBuilder::for($query)
            ->allowedSorts('created_at')
            ->defaultSort('-created_at')
            ->paginate(15);

        return AuditLogResource::collection($activities)
            ->additional([
                'meta' => [
                    'current_page' => $activities->currentPage(),
                    'per_page' => $activities->perPage(),
                    'total' => $activities->total(),
                    'last_page' => $activities->lastPage(),
                ],
                'message' => 'Audit logs retrieved successfully',
            ]);
    }
}
