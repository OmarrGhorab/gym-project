<?php

namespace App\Http\Controllers\Api\V1;

use App\Actions\Plans\StorePlan;
use App\Actions\Plans\TogglePlanActive;
use App\Actions\Plans\UpdatePlan;
use App\Http\Requests\Plans\StorePlanRequest;
use App\Http\Requests\Plans\UpdatePlanRequest;
use App\Http\Resources\PlanResource;
use App\Models\Plan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\QueryBuilder;

/**
 * US2 — Manage Plans & Offers
 *
 * Thin controller: validates via FormRequests, authorizes via PlanPolicy,
 * delegates logic to Actions, shapes responses via PlanResource.
 */
final class PlanController extends ApiController
{
    /**
     * GET /api/v1/plans
     */
    public function index(): AnonymousResourceCollection
    {
        $this->authorize('viewAny', Plan::class);

        $plans = QueryBuilder::for(Plan::class)
            ->allowedFilters(
                AllowedFilter::exact('type'),
                AllowedFilter::exact('is_active'),
            )
            ->allowedSorts('name', 'price', 'duration_days', 'created_at')
            ->paginate(15);

        return PlanResource::collection($plans)
            ->additional([
                'meta' => [
                    'current_page' => $plans->currentPage(),
                    'per_page' => $plans->perPage(),
                    'total' => $plans->total(),
                    'last_page' => $plans->lastPage(),
                ],
                'message' => 'Plans retrieved',
            ]);
    }

    /**
     * POST /api/v1/plans
     */
    public function store(StorePlanRequest $request, StorePlan $action): JsonResponse
    {
        $plan = $action->handle($request->validated());

        return (new PlanResource($plan))
            ->withMessage('Plan created')
            ->response()
            ->setStatusCode(201);
    }

    /**
     * GET /api/v1/plans/{plan}
     */
    public function show(Plan $plan): JsonResponse
    {
        $this->authorize('view', $plan);

        return (new PlanResource($plan))
            ->withMessage('Plan retrieved')
            ->response()
            ->setStatusCode(200);
    }

    /**
     * PUT /api/v1/plans/{plan}
     */
    public function update(UpdatePlanRequest $request, Plan $plan, UpdatePlan $action): JsonResponse
    {
        $plan = $action->handle($plan, $request->validated());

        return (new PlanResource($plan))
            ->withMessage('Plan updated')
            ->response()
            ->setStatusCode(200);
    }

    /**
     * PATCH /api/v1/plans/{plan}/toggle
     */
    public function toggle(Plan $plan, TogglePlanActive $action): JsonResponse
    {
        $this->authorize('update', $plan);

        $plan = $action->handle($plan);

        return (new PlanResource($plan))
            ->withMessage('Plan status toggled')
            ->response()
            ->setStatusCode(200);
    }

    /**
     * DELETE /api/v1/plans/{plan}
     */
    public function destroy(Plan $plan): JsonResponse
    {
        $this->authorize('delete', $plan);

        if ($plan->subscriptions()->where('status', 'active')->exists()) {
            return $this->error(
                'plan_has_subscriptions',
                'Plan cannot be deleted while it has active subscriptions.',
                [],
                422,
            );
        }

        $plan->delete();

        return $this->success(
            null,
            'Plan deleted',
            [],
            200,
        );
    }
}
