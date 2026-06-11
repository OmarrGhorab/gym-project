<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Resources\AuditLogResource;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\ValidationException;
use Spatie\Activitylog\Models\Activity;
use Spatie\QueryBuilder\QueryBuilder;

final class AuditLogController extends ApiController
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Activity::class);

        // Validate the filter query parameters
        $validator = validator($request->all(), [
            'filter.from' => ['nullable', 'date'],
            'filter.to' => ['nullable', 'date', 'after_or_equal:filter.from'],
            'filter.subject' => ['nullable', 'string', function ($attribute, $value, $fail): void {
                if (! array_key_exists($value, AuditLogResource::$aliasMap)) {
                    $fail('The selected subject alias is invalid.');
                }
            }],
            'filter.causer' => ['nullable', 'integer'],
        ]);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }

        $query = Activity::query()->with(['causer', 'subject']);
        $filters = $request->input('filter', []);

        if (isset($filters['from'])) {
            $query->whereDate('created_at', '>=', $filters['from']);
        }
        if (isset($filters['to'])) {
            $query->whereDate('created_at', '<=', $filters['to']);
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
                    'per_page' => $activities->perPage(),
                    'total' => $activities->total(),
                    'last_page' => $activities->lastPage(),
                ],
                'message' => 'Audit logs retrieved successfully',
            ]);
    }
}
