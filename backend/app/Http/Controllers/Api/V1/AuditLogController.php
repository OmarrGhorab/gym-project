<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Requests\AuditLog\IndexAuditLogRequest;
use App\Http\Resources\AuditLogResource;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\Models\Activity;
use Spatie\QueryBuilder\QueryBuilder;

final class AuditLogController extends ApiController
{
    public function index(IndexAuditLogRequest $request): AnonymousResourceCollection
    {
        $query = Activity::query()->with(['causer', 'subject']);

        if ($from = $request->validated('filter.from')) {
            $query->where('created_at', '>=', Carbon::parse($from)->startOfDay());
        }
        if ($to = $request->validated('filter.to')) {
            $query->where('created_at', '<=', Carbon::parse($to)->endOfDay());
        }
        if ($subject = $request->validated('filter.subject')) {
            $query->where('subject_type', AuditLogResource::$aliasMap[$subject]);
        }
        if ($causer = $request->validated('filter.causer')) {
            $query->where('causer_id', $causer);
        }
        if ($action = $request->validated('filter.action')) {
            $query->where('event', $action);
        }
        if ($logName = $request->validated('filter.log_name')) {
            $query->where('log_name', $logName);
        }

        $activities = QueryBuilder::for($query)
            ->allowedSorts('created_at')
            ->defaultSort('-created_at')
            ->paginate((int) ($request->validated('per_page') ?? 15))
            ->withQueryString();

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
