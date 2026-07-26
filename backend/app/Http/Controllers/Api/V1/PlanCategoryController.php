<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\PlanCategories\StorePlanCategoryRequest;
use App\Http\Requests\PlanCategories\UpdatePlanCategoryRequest;
use App\Http\Resources\PlanCategoryResource;
use App\Models\PlanCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class PlanCategoryController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = PlanCategory::query()->withCount('plans')->orderBy('name');

        // The management screen needs retired categories too; the plan form does not.
        if (! $request->boolean('include_inactive')) {
            $query->active();
        }

        if (($type = $request->string('type')->toString()) !== '') {
            $query->where('plan_type', $type);
        }

        return PlanCategoryResource::collection($query->get());
    }

    public function store(StorePlanCategoryRequest $request): JsonResponse
    {
        // Slug, plan_type validation and the plan_scope default are all
        // handled by the model's saving hook.
        $category = PlanCategory::query()->create($request->validated());

        return (new PlanCategoryResource($category->loadCount('plans')))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdatePlanCategoryRequest $request, PlanCategory $planCategory): PlanCategoryResource
    {
        $planCategory->update($request->validated());

        return new PlanCategoryResource($planCategory->loadCount('plans'));
    }

    /**
     * Deactivates rather than deletes, so plans already pointing at the slug keep
     * resolving. System categories are refused outright: subscription pricing and
     * the coach report branch on their slugs.
     */
    public function destroy(PlanCategory $planCategory): JsonResponse
    {
        if ($planCategory->isSystem()) {
            return response()->json([
                'message' => "\"{$planCategory->name}\" is a built-in category and cannot be removed.",
            ], 422);
        }

        $planCategory->update(['is_active' => false]);

        return response()->json(null, 204);
    }
}
