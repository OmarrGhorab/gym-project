<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\PlanCategories\StorePlanCategoryRequest;
use App\Http\Requests\PlanCategories\UpdatePlanCategoryRequest;
use App\Http\Resources\PlanCategoryResource;
use App\Models\PlanCategory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;

final class PlanCategoryController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $categories = PlanCategory::query()
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        return PlanCategoryResource::collection($categories);
    }

    public function store(StorePlanCategoryRequest $request): JsonResponse
    {
        $validated = $request->validated();

        if (empty($validated['slug'])) {
            $validated['slug'] = Str::slug($validated['name'], '_');
        }

        $category = PlanCategory::query()->create($validated);

        return (new PlanCategoryResource($category))
            ->response()
            ->setStatusCode(201);
    }

    public function update(UpdatePlanCategoryRequest $request, PlanCategory $planCategory): PlanCategoryResource
    {
        $validated = $request->validated();
        $planCategory->update($validated);

        return new PlanCategoryResource($planCategory);
    }

    public function destroy(PlanCategory $planCategory): JsonResponse
    {
        $planCategory->update(['is_active' => false]);

        return response()->json(null, 204);
    }
}
