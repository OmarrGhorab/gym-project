<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Resources\UserResource;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Spatie\QueryBuilder\AllowedFilter;
use Spatie\QueryBuilder\AllowedSort;
use Spatie\QueryBuilder\QueryBuilder;

final class UserController extends ApiController
{
    public function index(Request $request): JsonResponse
    {
        $request->user()->can('roles.manage') || abort(403);

        $users = QueryBuilder::for(User::class)
            ->with('roles')
            ->allowedFilters(
                AllowedFilter::callback('search', function ($query, string $value): void {
                    $query->where(function ($inner) use ($value): void {
                        $inner->where('name', 'like', "%{$value}%")
                            ->orWhere('email', 'like', "%{$value}%");
                    });
                }),
                AllowedFilter::callback('role', function ($query, string $value): void {
                    $query->role($value);
                }),
            )
            ->allowedSorts(
                AllowedSort::field('name'),
                AllowedSort::field('email'),
                AllowedSort::field('created_at'),
            )
            ->defaultSort('-created_at')
            ->paginate(15)
            ->withQueryString();

        return $this->success(
            data: UserResource::collection($users->getCollection())->resolve(),
            message: 'Users retrieved successfully',
            meta: [
                'current_page' => $users->currentPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
                'last_page' => $users->lastPage(),
            ],
        );
    }
}
